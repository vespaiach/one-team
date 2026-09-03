# Implementation Plan: Labels

**Branch**: `claude/roadmap-r8-specifications-3a47f8` | **Date**: 2026-09-01 | **Spec**: [`spec.md`](./spec.md)

**Input**: Feature specification from [`specs/007-labels-management/spec.md`](./spec.md) and roadmap
entry **R8**, whose scope boundary this plan does not widen.

## Summary

R8 builds one team-wide vocabulary — `label` — and the join that applies it — `issue_label` — plus a
curation page for admins (`/settings/labels`) and one picker component wired into two of R6's screens
(the issue rail, Create issue). Five mutators: `createLabel`, `updateLabel`, `deleteLabel` (admin only),
`addIssueLabel`, `removeIssueLabel` (any project member, matching `isMember`).

**A label carries no colour.** The product specification's Modernist design system (§7, *Palette*)
retired per-project, per-column and per-label colour product-wide — a label is told apart by name
alone (§3.10), the same as a project or a board column. `label.color`, a swatch picker, and any move
of a palette module are out of this plan's scope entirely.

**One decision carries the design**, and it is forced by something outside the spec rather than chosen
for taste. The `label_added` / `label_removed` activity rows `FR-021` requires are written through a
shared writer that entry **R7 — Comments and activity feeds — owns.** R7 now has a landed spec and plan,
which pins the exact row shape each write takes, straight from §5's own `activity` table definition —
fully specified independent of which entry builds the table — and pins `writeActivity`'s module path
and signature. What it does not yet do is include `label_added` / `label_removed` in that signature's
`type` union, or exist in code at all: no `activity` table, no `writeActivity` function. This is one
narrow, explicitly-flagged gap — every other decision in this plan holds regardless of when R7 arrives.

Full reasoning in [`research.md`](./research.md) — twenty decisions across four groups. The five
mutators in [`contracts/mutators.md`](./contracts/mutators.md), the one route and two edited screens in
[`contracts/screens.md`](./contracts/screens.md).

## Technical Context

**Precondition — entries R2, R3, R5 and R6 are not implemented yet; only R1 is.** The tree today holds
`src/app`, `src/db`, `src/features/auth` and two migrations at the time this plan was first written.
**R2, R5 and R6 are now implemented** — the shell's **Labels** sidebar entry, `forbidden()`, the toast
and disabled-with-reason conventions, the guard-only page this feature fills (R2); `project`,
`project_member`, the `isMember` predicate (R5); `issue`, the issue rail and Create issue form this
feature edits, `createIssue` itself (R6). **R3 is not a precondition** — this feature reads no
invitation or account-closure state beyond what R5's and R6's own dependencies already carry.

**R7 remains a precondition for one narrow requirement.** `FR-021`'s two activity writes need R7's
`activity` table and `writeActivity` function to actually exist in code — R7's plan alone is not
enough, since its `writeActivity` signature does not yet admit `label_added` / `label_removed` in its
`type` union. Every other requirement in this feature (all twenty-one others) is implementable and
testable without R7 existing at all, since `addIssueLabel` and `removeIssueLabel`'s core write (the
`issue_label` row itself, and the idempotency `FR-022` requires) does not depend on the activity call
succeeding or existing. ([`research.md`](./research.md) C-6.)

**Language/Version**: TypeScript 7.0.2, `strict`. No `any`, no non-null assertions, no `@ts-ignore`.

**Primary Dependencies**: Next.js 16.3.2 (App Router), React 19.2.8 with React Compiler enabled,
`react-aria-components` 1.20.0, `drizzle-orm` 0.45.2 over `postgres` 3.4.9, Tailwind CSS v4 configured
in CSS, Biome 2.4.2.

**Dependencies this feature installs**: none. Every capability it needs — `ListBox` multi-select,
`AlertDialog` — is already `react-aria-components`, already approved, already in `package.json`.

**Dependencies this feature deliberately does not install**: nothing new to refuse — there is no
markdown, no date picker, and no colour picker of any kind in this feature's scope.

**Configuration this feature changes**: none. `next.config.ts` and `vitest.config.mts` are untouched.

**Storage**: PostgreSQL 18 via Drizzle. **Two tables added** (`label`, `issue_label`). No table this
feature owns is altered by a later entry as far as this plan can see, and this feature alters none of
R5's or R6's tables. One migration, generated with `db:generate` and its SQL inspected before commit.

**Testing**: Vitest 4.1.11 in R1's two projects — `server` (node) for the schema constraints, the five
mutators, and the two queries; `ui` (jsdom, `@testing-library/react`) for every component. Persistence
tests run against the real PostgreSQL instance `TEST_DATABASE_URL` names, on a separate database.

**Target Platform**: self-hosted on a single box, Node.js runtime. Desktop browser only.

**Project Type**: web application — one Next.js project, no separate frontend and backend.

**Performance Goals**: none stated by the specification, and none invented. The labels page is one
query; each picker is one query.

**Constraints**: labels are curated by admins, applied by anyone who can write (`OT-AUTHZ-010`) · the
server check is the enforcement, the client's predicate is presentation (`OT-AUTHZ-005`, `FR-020`) · no
value a user types is ever silently shortened (II) · a label carries no colour — name alone tells it
apart (§7 *Palette*, §3.10) · a uniqueness clash names the existing holder, never a silent suffix
(`OT-UX-012`) · deletes are hard, cascade in the database, in one transaction (`OT-DATA-007`, `-008`) ·
navigation to an admin-only screen hides rather than disables (`OT-UX-003`) · no dependency outside
`AGENTS.md`'s table (IV) · no seam built for a later entry (I, III, VI).

**Scale/Scope**: one installation, one team under twenty people. 21 functional requirements, 2 user
stories, 12 acceptance scenarios, 6 edge cases, 6 success criteria, 1 new route, 2 edited screens, 6
components, 5 Server Actions, 2 tables added.

**Unknowns**: one outstanding, and it is R7's writer signature and `type` union
([`research.md`](./research.md) C-6), not a gap in this feature's own requirements. The research
decisions resolve everything else; one assumption is carried forward (research.md, *Assumptions carried
forward*): the activity writer's shape. It does not block writing tasks; it names the one place a task
stays open until R7 lands.

## Constitution Check

*GATE: evaluated once, against the completed Phase 1 design below — both the pre-research assessment
and the post-design re-check land on the same row, since no decision in Phase 1 introduced a new
principle question beyond what Phase 0 had already settled.*

Principles are hosted in [`AGENTS.md`](../../AGENTS.md);
[`.specify/memory/constitution.md`](../../.specify/memory/constitution.md) holds governance and the
version record (v1.0.0).

| | Principle | Assessment |
| --- | --- | --- |
| **I** | Component-Driven Architecture | One abstraction is extracted at its genuine second call site on day one: `LabelPickerField`, serving the issue rail and Create issue both from this feature's own first release ([`research.md`](./research.md) D-4). `LabelFormModal` serves Create and Edit as one component, populated conditionally, mirroring R5's own `EditableField` precedent. Nothing else is extracted: the two curation queries stay inline, `src/components/ui` is still not created. |
| **II** | Validated Input Boundaries | Five Server Actions, each a public server entry point, each re-deriving its authorization and its project from stored rows, never from an argument (`FR-020`). Name length is enforced by a database `CHECK`, not only by the modal's on-blur check ([`research.md`](./research.md) A-6). Over-length input is refused, never truncated or coerced. |
| **III** | Straightforward Over Clever | `addIssueLabel` / `removeIssueLabel` are one `INSERT ... ON CONFLICT DO NOTHING` and one `DELETE`, not a read-then-branch. The delete confirmation's count is one `COUNT(*)`, read twice (dialog, transaction), not a running counter maintained on `label`. No hook registry or dispatch layer sits between this feature's mutators and R7's eventual activity call — the call site is a direct function call, pinned by contract, waiting on R7's plan to exist. |
| **IV** | Built-In Features Over Third-Party Libraries | Zero new dependencies. Every control is `react-aria-components`, already approved. |
| **V** | Intention-Revealing Code Without Comments | No comments in the diff. The one place a reader will want an explanation — why `addIssueLabel`'s activity write is a pinned contract rather than a working import — is answered by [`research.md`](./research.md) C-6 and by [`contracts/mutators.md`](./contracts/mutators.md), not by annotation. |
| **VI** | No Dead Code | `LabelOption` carries no usage count; `LabelView` carries no `applied` flag — each DTO holds only what its one caller reads. A no-op `addIssueLabel` or `removeIssueLabel` writes no activity row, not a suppressed one ([`research.md`](./research.md) C-5). |
| **VII** | Test-First (NON-NEGOTIABLE) | All 12 acceptance scenarios are carried by a Red step written before its implementation, per `tasks.md`. Every structural requirement (`FR-006`, `FR-007`, `FR-014`, `FR-019`…`FR-022`) is tested by attempting the violating or racing write against the real database and asserting the refusal or the settle, the same method `AGENTS.md` and R6's own precedent fix. `FR-021`'s two activity-writing lines are the one pair of assertions this feature cannot make Red-then-Green against a real `recordActivity` until R7's plan lands; `tasks.md` marks that pair **blocked**, not skipped, and gate 8 does not pass with a skipped test standing in for it. |

### Gates 1–8

| # | Gate | How it is met |
| --- | --- | --- |
| 1 | A test written first and observed failing | Each task in `tasks.md` pairs one scenario with one implementation; the commit order is the evidence. The two activity-writing tasks stay open, not faked, until R7's plan supplies a real target |
| 2 | Minimal implementation, then refactor green | Scoped per task. No mutator does more than its contract in [`contracts/mutators.md`](./contracts/mutators.md) |
| 3 | Server-side validation at every touched boundary | Principle II row above. Five actions, authorization before validation, project and label state re-derived from stored rows |
| 4 | No unapproved dependency | None installed. Nothing to record |
| 5 | `npm run style-check` clean | Run as part of `npm run verify` |
| 6 | No comments, no commented-out code, no dead code | Principles V and VI rows above |
| 7 | Every changed line traces to a requirement | Each file in Project Structure below names the requirement that puts it there. The two edits to R5's and R6's own trees are named in Complexity Tracking |
| 8 | `npm test` passes with nothing failing or skipped | Run as part of `npm run verify`, once R7's writer exists to complete the two blocked tasks; until then this feature's own suite (everything but those two assertions) passes on its own |

## Project Structure

### Documentation (this feature)

```text
specs/007-labels-management/
├── spec.md                     the feature specification
├── plan.md                     this file
├── research.md                 Phase 0 — 20 decisions, four groups
├── data-model.md               Phase 1 — two tables added, two DTOs, five mutators summarized
├── quickstart.md               Phase 1 — 13 walkthroughs, and what a browser cannot show
├── contracts/
│   ├── mutators.md             createLabel, updateLabel, deleteLabel, addIssueLabel, removeIssueLabel
│   └── screens.md              the one route, the two edited screens, the shared picker
├── checklists/
│   └── requirements.md         spec-quality gate — 16/16
└── tasks.md                    Phase 2 output (/speckit-tasks — not created by this command)
```

### Source code (repository root)

Every path below is created, moved, or edited by this feature, and each names why it exists.

```text
src/
├── db/
│   ├── schema.ts                          EDIT — label, issue_label            FR-006…FR-022
│   └── test-database.ts                   EDIT — "label", "issue_label" into TRUNCATED_TABLES
├── app/(app)/settings/labels/page.tsx     FILL (R2's guard) — isAdmin, Suspense over the list
│                                                                              FR-001…FR-004
└── features/
    ├── labels/
    │   ├── actions.ts                     "use server" — the five entry points
    │   ├── components/
    │   │   ├── labels-screen.tsx          synchronous — table or empty line   FR-003, FR-004
    │   │   ├── label-row.tsx              name, count, Edit, Delete           FR-005
    │   │   ├── label-form-modal.tsx       "use client" — Create and Edit, one component
    │   │   │                                                                  FR-006, FR-009
    │   │   ├── delete-label-dialog.tsx    "use client" — AlertDialog, real count
    │   │   │                                                                  FR-011, FR-012
    │   │   └── label-picker-field.tsx     "use client" — presentational, two callers in R6
    │   │                                                                      FR-015…FR-018
    │   └── server/
    │       ├── create-label.ts                                               FR-006…FR-008
    │       ├── update-label.ts                                               FR-009, FR-010
    │       ├── delete-label.ts                                               FR-011…FR-013
    │       ├── issue-labels.ts            addIssueLabel, removeIssueLabel     FR-019…FR-022
    │       └── queries.ts                 listLabelsWithUsage,
    │                                       listLabelOptionsForIssue,
    │                                       checkLabelNameAvailable            FR-003, FR-017
    └── issues/                            EDIT (R6's) — three touches:
                                              · issue-rail.tsx gains LabelPickerField      FR-015
                                              · create-issue-form.tsx gains LabelPickerField FR-016
                                              · create-issue.ts (server) accepts labelIds  FR-016

drizzle/<next>_*.sql + meta                NEW — generated, inspected, committed
```

Untouched and named so: `next.config.ts`, `vitest.config.mts`, `tsconfig.json`, `drizzle.config.ts`,
`src/app/layout.tsx`, `src/app/provider.tsx`, `src/app/globals.css`, `src/app/(auth)/`,
`src/features/auth/`, `proxy.ts`, `src/instrumentation.ts`, `src/components/ui/` (still not created),
`src/lib/` (nothing this feature needs is pure data with no JSX).

**Structure Decision.** `AGENTS.md`'s rules, followed exactly. `src/app` holds one page whose whole body
is the guard and a `Suspense` boundary — no domain module lives there. All behaviour is in
`src/features/labels/`, with everything that touches the database under its `server/` directory.
`src/features/labels/actions.ts` carries the top-level `"use server"` and is the only module a Client
Component imports server behaviour from. No barrel file mixes server and client exports.

`label-picker-field.tsx` stays inside `src/features/labels/components/` rather than moving to `shared`,
because its two callers are both inside R6's own `issues` feature reading across a feature boundary —
the same shape R6 already established reading R5's project and column data directly
([`research.md`](./research.md) D-5). Promotion to `shared` is for a component two *independent*
features need identically with no domain coupling to either; `LabelPickerField` is a labels-domain
component the issues feature is allowed to import, not a domain-neutral primitive.

## Complexity Tracking

Two items where the design reaches into work another entry owns, or leaves a requirement's second half
genuinely unimplementable today. Each is recorded so a reviewer meets it here rather than discovering it
in the diff.

| Violation | Why needed | Simpler alternative rejected because |
| --- | --- | --- |
| **`addIssueLabel` and `removeIssueLabel`'s activity write calls a function this plan cannot define** (`FR-021`, blocked on R7's code, not merely its plan) | R7 — Comments and activity feeds — is the entry the roadmap names as establishing the shared `activity` writer every later caller (R9's column events, this feature's label events) writes through rather than inventing a sixth insert of its own. R7 now has a landed plan pinning `writeActivity`'s module path and signature, but that signature's `type` union does not yet admit `label_added` / `label_removed`, and no table or function exists in code. This plan pins the exact row shape from §5's own `activity` table definition ([`research.md`](./research.md) C-6) — the row is fully specified regardless of who builds the table — but the call itself is a placeholder import until R7 is implemented. | *Write directly to the `activity` table from this feature, bypassing a shared writer.* A sixth, independent insert implementation of the same one-row-per-change contract R5's and R6's mutators, R7's own comment mutators, and R9's column events all share — exactly the drift Principle I extracts against, and the roadmap already commits R9 to the shared writer in these same words. *Defer `FR-021` to a later feature entirely.* `FR-021` is this feature's own requirement, not a deferred one in the spec's Assumptions; the correct scope is to implement everything else now and leave this one pair of tasks open, which is what `tasks.md` does. |

## Phase status

| Phase | Output | Status |
| --- | --- | --- |
| 0 — Outline & research | [`research.md`](./research.md) | complete — reconciled with the monochrome design decision (no `label.color`); one assumption carried forward, one unknown outstanding (R7's writer signature and `type` union) |
| 1 — Design & contracts | [`data-model.md`](./data-model.md), [`contracts/`](./contracts/), [`quickstart.md`](./quickstart.md) | complete — reconciled, no colour anywhere in this feature |
| Constitution re-check | this file | complete — pass, one item in Complexity Tracking |
| 2 — Tasks | [`tasks.md`](./tasks.md) | generated — `/speckit-tasks` |
| Implementation | — | R2, R5, R6 implemented; `FR-021`'s activity write stays **blocked on R7's code existing** (R7 has a plan, no implementation) |
| 3–5 — US1, US2, Polish | [`tasks.md`](./tasks.md) T007–T051 | complete — `npm run verify` green (1409 tests, none skipped); `T045`/`T046` (`FR-021`'s activity rows) remain the one open pair, still blocked on R7 |
