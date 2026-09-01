# Implementation Plan: Labels

**Branch**: `claude/roadmap-r8-specifications-3a47f8` | **Date**: 2026-09-01 | **Spec**: [`spec.md`](./spec.md)

**Input**: Feature specification from [`specs/007-labels-management/spec.md`](./spec.md) and roadmap
entry **R8**, whose scope boundary this plan does not widen.

## Summary

R8 builds one team-wide vocabulary — `label` — and the join that applies it — `issue_label` — plus a
curation page for admins (`/settings/labels`) and one picker component wired into two of R6's screens
(the issue rail, Create issue). Five mutators: `createLabel`, `updateLabel`, `deleteLabel` (admin only),
`addIssueLabel`, `removeIssueLabel` (any project member, matching `isMember`).

**Two decisions carry the design**, and both are forced by something outside the spec rather than
chosen for taste.

The seven-value colour palette this feature needs for `label.color` is not a fresh decision: R5 already
wrote the exact `CHECK` literal for `project.color` and `board_column.color`, and R5's plan already
built the swatch-picking UI for it — kept local to R5's own feature directory because R5's two uses
never crossed a feature boundary. This feature's `label.color` is the first use that does, which is
precisely the condition `AGENTS.md` sets for promotion under Principle I. So this plan **moves**
`src/features/projects/palette.ts` to `src/lib/palette.ts` and
`src/features/projects/components/palette-field.tsx` to `src/components/shared/palette-field.tsx` — a
reach-back into R5's inherited work, the same shape R6 already used when it moved R5's markdown renderer
to `src/components/shared/markdown/` at its own second call site.

The `label_added` / `label_removed` activity rows `FR-021` requires are written through a shared writer
that entry **R7 — Comments and activity feeds — owns, and R7 has no child spec yet.** This plan pins the
exact row shape each write takes, straight from §5's own `activity` table definition, which is fully
specified independent of which entry builds the table. What it cannot pin is the writer's function
signature or its module path, because no plan has fixed either. This is one narrow, explicitly-flagged
gap — every other decision in this plan holds regardless of when R7 arrives.

Full reasoning in [`research.md`](./research.md) — twenty decisions across four groups. The five
mutators in [`contracts/mutators.md`](./contracts/mutators.md), the one route and two edited screens in
[`contracts/screens.md`](./contracts/screens.md).

## Technical Context

**Precondition — entries R2, R3, R5 and R6 are not implemented yet; only R1 is.** The tree today holds
`src/app`, `src/db`, `src/features/auth` and two migrations. This feature is complete as a plan and
`/speckit-tasks` can be run against it, but **implementation is blocked until R2, R5 and R6 land** —
from R2: the shell's **Labels** sidebar entry, `forbidden()`, the toast and disabled-with-reason
conventions, the guard-only page this feature fills; from R5: `project`, `project_member`, the
`isMember` predicate, the seven-value palette and its swatch picker (moved here, not rebuilt); from R6:
`issue`, the issue rail and Create issue form this feature edits, `createIssue` itself (gaining one
optional field). **R3 is not a precondition** — this feature reads no invitation or account-closure
state beyond what R5's and R6's own dependencies already carry.

**R7 is a partial precondition, and a stricter one than R2/R5/R6.** `FR-021`'s two activity writes need
not R7's *code* but R7's *plan* — the module and function signature its writer will expose. Every other
requirement in this feature (all twenty-one others) is implementable and testable without R7 existing at
all, since `addIssueLabel` and `removeIssueLabel`'s core write (the `issue_label` row itself, and the
idempotency `FR-022` requires) does not depend on the activity call succeeding or existing.
([`research.md`](./research.md) C-6.)

**Language/Version**: TypeScript 7.0.2, `strict`. No `any`, no non-null assertions, no `@ts-ignore`.

**Primary Dependencies**: Next.js 16.3.2 (App Router), React 19.2.8 with React Compiler enabled,
`react-aria-components` 1.20.0, `drizzle-orm` 0.45.2 over `postgres` 3.4.9, Tailwind CSS v4 configured
in CSS, Biome 2.4.2.

**Dependencies this feature installs**: none. Every capability it needs — `ListBox` multi-select,
`RadioGroup`, `AlertDialog` — is already `react-aria-components`, already approved, already in
`package.json`.

**Dependencies this feature deliberately does not install**: nothing new to refuse — there is no
markdown, no date picker, and no third-party colour picker in this feature's scope.

**Configuration this feature changes**: none. `next.config.ts` and `vitest.config.mts` are untouched.

**Storage**: PostgreSQL 18 via Drizzle. **Two tables added** (`label`, `issue_label`). No table this
feature owns is altered by a later entry as far as this plan can see, and this feature alters none of
R5's or R6's tables — the palette move is a TypeScript module move, not a schema change. One migration,
generated with `db:generate` and its SQL inspected before commit.

**Testing**: Vitest 4.1.11 in R1's two projects — `server` (node) for the schema constraints, the five
mutators, and the two queries; `ui` (jsdom, `@testing-library/react`) for every component. Persistence
tests run against the real PostgreSQL instance `TEST_DATABASE_URL` names, on a separate database.

**Target Platform**: self-hosted on a single box, Node.js runtime. Desktop browser only.

**Project Type**: web application — one Next.js project, no separate frontend and backend.

**Performance Goals**: none stated by the specification, and none invented. The labels page is one
query; each picker is one query.

**Constraints**: labels are curated by admins, applied by anyone who can write (`OT-AUTHZ-010`) · the
server check is the enforcement, the client's predicate is presentation (`OT-AUTHZ-005`, `FR-020`) · no
value a user types is ever silently shortened (II) · a colour is always one of seven values, with no
free entry and no per-surface palette (`OT-DATA-013`) · a uniqueness clash names the existing holder,
never a silent suffix (`OT-UX-012`) · deletes are hard, cascade in the database, in one transaction
(`OT-DATA-007`, `-008`) · navigation to an admin-only screen hides rather than disables
(`OT-UX-003`) · no dependency outside `AGENTS.md`'s table (IV) · no seam built for a later entry (I, III,
VI).

**Scale/Scope**: one installation, one team under twenty people. 22 functional requirements, 2 user
stories, 12 acceptance scenarios, 6 edge cases, 6 success criteria, 1 new route, 2 edited screens, 8
components (2 new-and-moved: `palette.ts`, `palette-field.tsx`), 5 Server Actions, 2 tables added.

**Unknowns**: one outstanding, and it is R7's writer signature ([`research.md`](./research.md) C-6),
not a gap in this feature's own requirements. Twenty decisions across four research groups resolve
everything else; two assumptions are carried forward (research.md, *Assumptions carried forward*): the
activity writer's shape, and whether R5's plan has already moved the palette module by the time this
feature is implemented. Neither blocks writing tasks; each names the one place a task would need
retargeting.

## Constitution Check

*GATE: evaluated once, against the completed Phase 1 design below — both the pre-research assessment
and the post-design re-check land on the same row, since no decision in Phase 1 introduced a new
principle question beyond what Phase 0 had already settled.*

Principles are hosted in [`AGENTS.md`](../../AGENTS.md);
[`.specify/memory/constitution.md`](../../.specify/memory/constitution.md) holds governance and the
version record (v1.0.0).

| | Principle | Assessment |
| --- | --- | --- |
| **I** | Component-Driven Architecture | One abstraction is extracted at its genuine second call site on day one: `LabelPickerField`, serving the issue rail and Create issue both from this feature's own first release ([`research.md`](./research.md) D-4). One module is promoted *across* features, not merely reused within one — the palette, moved from R5's own feature directory to `src/lib/palette.ts` and `src/components/shared/palette-field.tsx` at its real second-feature call site (B-1). `LabelFormModal` serves Create and Edit as one component, populated conditionally, mirroring R5's own `EditableField` precedent. Nothing else is extracted: the two curation queries stay inline, `src/components/ui` is still not created. |
| **II** | Validated Input Boundaries | Five Server Actions, each a public server entry point, each re-deriving its authorization and its project from stored rows, never from an argument (`FR-020`). Name length and colour set are enforced by database `CHECK`s, not only by the modal's on-blur check ([`research.md`](./research.md) A-6, A-7). Over-length or off-palette input is refused, never truncated or coerced. |
| **III** | Straightforward Over Clever | `addIssueLabel` / `removeIssueLabel` are one `INSERT ... ON CONFLICT DO NOTHING` and one `DELETE`, not a read-then-branch. The delete confirmation's count is one `COUNT(*)`, read twice (dialog, transaction), not a running counter maintained on `label`. No hook registry or dispatch layer sits between this feature's mutators and R7's eventual activity call — the call site is a direct function call, pinned by contract, waiting on R7's plan to exist. |
| **IV** | Built-In Features Over Third-Party Libraries | Zero new dependencies. Every control is `react-aria-components`, already approved. |
| **V** | Intention-Revealing Code Without Comments | No comments in the diff. The two places a reader will want an explanation — why the palette moved out of R5's feature directory, and why `addIssueLabel`'s activity write is a pinned contract rather than a working import — are answered by [`research.md`](./research.md) B-1 and C-6 and by [`contracts/mutators.md`](./contracts/mutators.md), not by annotation. |
| **VI** | No Dead Code | `LabelOption` carries no usage count; `LabelView` carries no `applied` flag — each DTO holds only what its one caller reads. A no-op `addIssueLabel` or `removeIssueLabel` writes no activity row, not a suppressed one ([`research.md`](./research.md) C-5). The palette move deletes the old files rather than re-exporting them — no compatibility shim, matching `AGENTS.md`'s explicit refusal of re-export shims for removed code. |
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
├── lib/
│   └── palette.ts                         MOVED from src/features/projects/palette.ts — the
│                                             second-feature call site        research.md B-1
├── components/shared/
│   └── palette-field.tsx                  MOVED from
│                                             src/features/projects/components/palette-field.tsx
│                                                                              research.md B-1
├── app/(app)/settings/labels/page.tsx     FILL (R2's guard) — isAdmin, Suspense over the list
│                                                                              FR-001…FR-004
└── features/
    ├── labels/
    │   ├── actions.ts                     "use server" — the five entry points
    │   ├── components/
    │   │   ├── labels-screen.tsx          synchronous — table or empty line   FR-003, FR-004
    │   │   ├── label-row.tsx              swatch, name, count, Edit, Delete   FR-005
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
`src/features/auth/`, `proxy.ts`, `src/instrumentation.ts`, `src/components/ui/` (still not created).

**Structure Decision.** `AGENTS.md`'s rules, followed exactly. `src/app` holds one page whose whole body
is the guard and a `Suspense` boundary — no domain module lives there. All behaviour is in
`src/features/labels/`, with everything that touches the database under its `server/` directory.
`src/features/labels/actions.ts` carries the top-level `"use server"` and is the only module a Client
Component imports server behaviour from. Two modules leave R5's feature directory for the first time
under this plan — `palette.ts` to `src/lib` (pure data, no JSX, exactly what `AGENTS.md` reserves
`src/lib` for) and `palette-field.tsx` to `src/components/shared` (the same destination R6 already used
for the markdown renderer, at the same kind of second-call-site moment). No barrel file mixes server and
client exports.

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
| **`src/features/projects/palette.ts` and its swatch field are moved out of R5's feature directory** (a reach-back into R5's inherited work) | `label.color` is the second *feature* to need the identical seven-value palette and swatch-picking interaction R5 already built — the exact bar `AGENTS.md` sets for promoting a pattern out of one feature ([`research.md`](./research.md) B-1). Leaving a second copy in `src/features/labels/` would be two literals of the same `OT-DATA-013` constraint, free to drift, with R9's board columns already named in the roadmap as a third caller still to come. | *Copy the seven values and the swatch component into this feature instead of moving them.* Two implementations of one constraint is precisely what Principle I extracts against once a genuine second caller exists — and R5 itself never had to face this choice, because both its own uses stayed inside one feature. *Wait for R9 to be the one that promotes it.* R9 has no spec yet and an independent build order from R8 (roadmap §3); leaving the pattern unshared until a third caller shows up would leave this feature's own second-caller obligation unmet in the meantime. |
| **`addIssueLabel` and `removeIssueLabel`'s activity write calls a function this plan cannot define** (`FR-021`, blocked on R7's plan, not R7's code) | R7 — Comments and activity feeds — is the entry the roadmap names as establishing the shared `activity` writer every later caller (R9's column events, this feature's label events) writes through rather than inventing a sixth insert of its own. R7 has no child spec yet, so no plan exists to confirm the writer's actual function signature or module path against. This plan pins the exact row shape from §5's own `activity` table definition ([`research.md`](./research.md) C-6) — the row is fully specified regardless of who builds the table — but the call itself is a placeholder import until R7's plan lands. | *Write directly to the `activity` table from this feature, bypassing a shared writer.* A sixth, independent insert implementation of the same one-row-per-change contract R5's and R6's mutators, R7's own comment mutators, and R9's column events all share — exactly the drift Principle I extracts against, and the roadmap already commits R9 to the shared writer in these same words. *Defer `FR-021` to a later feature entirely.* `FR-021` is this feature's own requirement, not a deferred one in the spec's Assumptions; the correct scope is to implement everything else now and leave this one pair of tasks open, which is what `tasks.md` does. |

## Phase status

| Phase | Output | Status |
| --- | --- | --- |
| 0 — Outline & research | [`research.md`](./research.md) | complete — 20 decisions in four groups, two assumptions carried forward, one unknown outstanding (R7's writer signature) |
| 1 — Design & contracts | [`data-model.md`](./data-model.md), [`contracts/`](./contracts/), [`quickstart.md`](./quickstart.md) | complete |
| Constitution re-check | this file | complete — pass, two items in Complexity Tracking |
| 2 — Tasks | [`tasks.md`](./tasks.md) | not yet run — `/speckit-tasks` |
| Implementation | — | **blocked on entries R2, R5 and R6** (none built); `FR-021`'s activity write is additionally **blocked on R7's plan existing** (R7 has no spec yet) |
