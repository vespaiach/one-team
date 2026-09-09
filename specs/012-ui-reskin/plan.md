# Implementation Plan: UI reskin to the Broadsheet design system

**Branch**: `sdd/ui-reskin` | **Date**: 2026-09-08 | **Spec**: [`spec.md`](./spec.md)

**Input**: Feature specification from [`specs/012-ui-reskin/spec.md`](./spec.md). This feature has no
roadmap entry — `docs/ROADMAP.md` fixes `R1`…`R12` as immutable and complete, and every one of them
is a functional slice (identity, shell, accounts, profile, projects, issues, comments, labels, board
columns, board grouping/drag, notifications, Home). This plan restyles the surfaces those twelve
slices already delivered; it adds no `R13` and changes no `R1`–`R12` scope record.

## Summary

Replace the product's current "Modernist" visual system — a monochrome red-orange accent on a
near-white neutral ramp, one typeface (Archivo) for everything, a 4px spacing unit, and a hard
zero-radius reset — with the Broadsheet system the spec describes: a warm paper-and-ink palette
(clay/terracotta accent on cream), three typefaces each doing one job (Source Serif 4 for headings
and prose, Archivo for interface chrome, JetBrains Mono for machine values), a 5px spacing unit,
near-square (not zero) corner radii, and "rules, not boxes" — hairlines and whitespace replacing
filled panels except where a surface is genuinely elevated (a modal, a popover).

The technical approach is almost entirely a token-value change, not a component rewrite, because the
codebase already built the indirection this reskin needs: every component styles through a semantic
CSS custom property (`--color-accent-fill`, `--color-border`, `--font-heading`, `--spacing`), never a
literal hex or px value, and all three target typefaces are already loaded by `next/font/google` in
`src/app/layout.tsx` — the serif and mono variables just aren't routed to anything yet. So FR-001
through FR-003 land as edits to the single `@theme inline` block in `src/app/globals.css` plus its
base layer, and propagate to all 120 non-test component files with no per-file edit, verified by the
WCAG contrast contract test that already exists (`src/app/globals.test.ts`) and a token-resolution
contract (`theme-tokens.test.ts`'s pattern, generalised repo-wide). What *does* need a per-file sweep
is narrower than "every surface": arbitrary pixel values that bypass the spacing scale, two literal
non-token colour classes (`toast-region.tsx`), and the extraction of a dialog-shell pattern already
duplicated across seven files before this feature touches any of them. Full reasoning in
[`research.md`](./research.md) (decisions D-1 through D-8); the token contract in
[`contracts/design-tokens.md`](./contracts/design-tokens.md), the restyle inventory per UI pattern in
[`contracts/component-patterns.md`](./contracts/component-patterns.md), and the 22-route-file
checklist FR-006/SC-001 are measured against in
[`contracts/page-inventory.md`](./contracts/page-inventory.md).

## Technical Context

**Language/Version**: TypeScript 7.0.2, `strict`. No `any`, no non-null assertions, no `@ts-ignore`.

**Primary Dependencies**: Next.js 16.3.2 (App Router), React 19.2.8 with React Compiler enabled,
`react-aria-components` 1.20.0, Tailwind CSS v4 configured in CSS (`@theme inline` in
`src/app/globals.css`, no `tailwind.config.js`), Biome 2.4.2. `next/font/google` already loads
Archivo, Source Serif 4, and JetBrains Mono in `src/app/layout.tsx` — no font package, subset, or
loader call is added, removed, or changed by this feature.

**Dependencies this feature installs**: **none.** Gate 4 is satisfied trivially — this is a CSS
token and class-name change; no new package answers any part of the spec. (One pre-existing
condition, not introduced by this feature: `clsx` is present in `package.json`'s `dependencies` but
is not listed in AGENTS.md's approved-dependency table. This plan does not add, remove, or newly
depend on it — flagged in Complexity Tracking as a pre-existing gap this feature neither causes nor
is positioned to fix.)

**Storage**: PostgreSQL 18 via Drizzle. **Untouched.** `src/db/schema.ts` gains no column, table, or
migration — FR-009 fixes this feature as presentation-only, and `data-model.md` describes a
design-token model, not a persistence change.

**Testing**: Vitest 4.1.11 in the repo's two existing projects — `node` (server logic; unaffected by
this feature, since no server module changes) and `jsdom` with `@testing-library/react` (every
component). Two token-level contracts already exist and both apply directly:
`src/app/globals.css`'s WCAG contrast pairs in `src/app/globals.test.ts`, and the "every referenced
token resolves" pattern in `src/features/projects/components/theme-tokens.test.ts`, generalised to
every `src/features/*/components/` directory as part of this feature (research.md D-8.3). Component
tests that assert token *names* (`primary-button-classes.test.ts`, `card-footer-note.test.tsx`) pass
unmodified through a value-only change and are the evidence gate 8's "no regression" claim rests on.

**Target Platform**: self-hosted on a single box, Node.js runtime. Desktop browser only — no
responsive/mobile layout is introduced (spec *Assumptions*).

**Project Type**: web application — one Next.js project, no separate frontend and backend.

**Performance Goals**: none stated by the spec and none invented. No new dependency, no new query, no
new render path — a CSS custom-property value change and a bounded set of class-name edits.

**Constraints**: no dark theme (spec *Assumptions*) · no new responsive breakpoint (spec
*Assumptions*) · zero functional, data, copy, or navigation change (FR-009) · every existing
automated test keeps passing, with changes limited to visual/style assertions (SC-002) · 4.5:1 text /
3:1 non-text contrast on every restyled surface (SC-003) · no dependency outside AGENTS.md's table
(IV) · no new component library — `src/components/ui` is not created by this feature (I; the one
extraction this feature does make, the dialog shell, already has eight call sites before this
feature starts, so it does not establish that directory as a precedent for anything else).

**Scale/Scope**: 22 route files (`contracts/page-inventory.md`), 120 non-test `.tsx` component files
across 11 `src/features/*` directories plus `src/app` and `src/components/shared`, 337 existing test
files (198 `.test.ts` + 139 `.test.tsx`, per `vitest.config.mts`'s two projects) whose pass/fail
status is this feature's regression bar, one CSS file (`src/app/globals.css`)
carrying the entire token graph, one documentation paragraph (`docs/product/specifications.md` §7
*Palette*) that goes stale and is updated to match.

**Unknowns**: none outstanding. The spec's single open question (FR-006's surface list) was closed in
its own Clarifications section before planning started. Research settles the *how* — palette, type,
spacing, radius, and layout-convention mechanics — entirely from the spec's prose and the current
`globals.css`, since no design-brief or design-handoff artifact was imported for this feature
(research.md, preamble).

## Constitution Check

*GATE: passed before Phase 0, re-evaluated after Phase 1 design. Both evaluations below.*

Principles are hosted in [`AGENTS.md`](../../AGENTS.md);
[`.specify/memory/constitution.md`](../../.specify/memory/constitution.md) holds governance and the
version record (v1.0.0).

| | Principle | Assessment | Post-design |
| --- | --- | --- | --- |
| **I** | Component-Driven Architecture | No component library is created. The one extraction this feature makes — a shared dialog-shell class/component — already has eight call sites, past the two-site threshold, before this feature touches any of them (research.md D-6); every other file keeps its existing decomposition. | pass |
| **II** | Validated Input Boundaries | No input boundary is touched — no form, no Server Action, no route parameter, no header this feature reads or changes. FR-009 fixes the feature as presentation-only. | pass, gate 3 is vacuously satisfied |
| **III** | Straightforward Over Clever | A single `--spacing` variable and a single base-layer radius rule are chosen over per-component class edits precisely because they are the less clever, more traceable mechanism (research.md D-3, D-4) — the same mechanism the current zero-radius reset already uses. | pass |
| **IV** | Built-In Features Over Third-Party Libraries | No dependency added. The three typefaces load through `next/font/google`, already installed and already in use; no icon library, no CSS-in-JS, no animation library is introduced. | pass |
| **V** | Intention-Revealing Code Without Comments | No comment is added to any component or CSS file. `globals.css`'s existing explanatory comments (e.g. the "White text on the raw `--color-accent`…" note) are content this feature edits to stay accurate to the new values, not new prose introduced for its own sake. | pass |
| **VI** | No Dead Code | The dead `--font-heading`/`--font-body`/`--font-sans` → single-Archivo routing is replaced with real three-way use (research.md D-2), removing the one place today's token graph carries unused indirection. The seven-times-duplicated dialog-shell literal is deduplicated (D-6) rather than left as seven near-identical copies. | pass |
| **VII** | Test-First (NON-NEGOTIABLE) | Every acceptance scenario across all three user stories is a manual Red step in `quickstart.md` today (no automated visual-regression harness exists in this repo, and none is proposed — IV). Where this feature changes a component's *class shape*, not just a token's *value* — the dialog-shell extraction, the `toast-region.tsx` fix, any new WCAG pairing the new ramp needs — a failing assertion is written first, per research.md D-8, before the class changes. Where only a token *value* moves, the existing `globals.test.ts` and `theme-tokens.test.ts` contracts are the pre-existing Red/Green mechanism: they fail the moment a value or a reference is wrong, for every surface at once, without a new test per component. | pass |

### Gates 1–8

| # | Gate | How it is met |
| --- | --- | --- |
| 1 | A test written first and observed failing | `theme-tokens.test.ts`'s repo-wide generalisation is itself a Red step (fails against any pre-existing dangling reference the moment its glob widens); the dialog-shell and toast-region class-shape changes each get a new assertion, written and observed failing, before the component changes (research.md D-8) |
| 2 | Minimal implementation, then refactor green | The token edit is the whole implementation for every surface whose class shape doesn't change; the dialog-shell extraction and the toast fix are each scoped to exactly what their new test asserts |
| 3 | Server-side validation at every touched boundary | No boundary is touched — vacuous, and stated as such above rather than silently skipped |
| 4 | No unapproved dependency | None installed by this feature |
| 5 | `npm run style-check` passes with no findings | Run as part of `npm run verify` before this feature is reported complete |
| 6 | No comments, no commented-out code, no dead code | Principles V and VI rows above |
| 7 | Every changed line traces to a requirement | `contracts/page-inventory.md` and `contracts/component-patterns.md` are the traceability map — every file this feature touches is there because a specific FR names the surface or pattern it belongs to |
| 8 | `npm test` passes with no failing or skipped tests | Run as part of `npm run verify`; SC-002 is this gate's product-level restatement |

**Re-evaluation after Phase 1.** Design added no dependency and no speculative abstraction. Two things
worth recording precisely because they could look like scope creep to a reviewer who hasn't seen
research.md: the dialog-shell extraction (already justified by a threshold the feature didn't create)
and the `docs/product/specifications.md` §7 documentation edit (justified below, Complexity
Tracking). Both are recorded rather than left for a reviewer to discover.

## Project Structure

### Documentation (this feature)

```text
specs/012-ui-reskin/
├── spec.md                       existing
├── plan.md                       this file
├── research.md                   Phase 0 — 8 decisions (D-1…D-8) plus assumptions carried forward
├── data-model.md                 Phase 1 — the design-token model: role/ramp/semantic colour,
│                                  type step, spacing step, radius step, shadow step
├── contracts/
│   ├── design-tokens.md          the `globals.css` contract every component styles against
│   ├── component-patterns.md     the FR-004 restyle inventory, pattern by pattern
│   └── page-inventory.md         the FR-006/SC-001 checklist — 22 route files, one row each
├── quickstart.md                 Phase 1 — automated checks plus a manual walkthrough per user story
├── checklists/
│   └── requirements.md           existing
└── tasks.md                      Phase 2 output — NOT created by this command
```

### Source code (repository root)

Every path below is edited by this feature (none is new except where marked); nothing is removed.

```text
src/app/globals.css                     the whole token graph: palette, ramps, type, spacing unit,
                                         radius, shadow tuning                    FR-001…FR-003, FR-008
docs/product/specifications.md §7       the Palette paragraph, updated to describe the values that
                                         now ship (documentation only — no version bump, no history
                                         row, per the user's own memory constraint)
src/features/shell/components/
  toast-region.tsx                      the two literal-colour error/warning variants → semantic tokens FR-001
src/components/shared/
  dialog-panel.(ts|tsx)  [NEW]          the shared shell extracted from eight call sites      research.md D-6
src/features/{projects,labels,accounts,issues}/components/
  delete-column-dialog.tsx
  delete-label-dialog.tsx
  label-form-modal.tsx
  delete-project-control.tsx
  roster-table.tsx
  invite-modal.tsx
  delete-issue-control.tsx              each updated to use the shared dialog shell        FR-003, FR-004
src/features/*/components/**/*.tsx      (95 files total) — no edit needed for token-value-only
                                         changes; a per-file sweep confirms any arbitrary spacing
                                         pixel value (`gap-[14px]`, …) is either already a multiple
                                         of the new 5px unit or nudged to the nearest one. Fixed
                                         layout-constraint dimensions (`max-w-[420px]`, …) are exempt
                                         under Rule 4 and left untouched, not nudged        FR-003
src/app/globals.test.ts                 unchanged in shape; re-validates automatically against the
                                         new ramp (any new WCAG pairing gets a new row, added before
                                         the ramp lands; FR-008's focus-visibility check rides the
                                         same 3:1 pairing, not a separate mechanism)  FR-007, FR-008, SC-003
src/features/*/components/theme-tokens.test.ts [pattern generalised repo-wide, replacing the single
                                         projects/-scoped copy]                                  FR-001
```

Untouched and named so: `src/db/schema.ts`, `drizzle/`, every Server Action and query module, every
route handler, `src/app/layout.tsx` (already loads the three typefaces — no loader change),
`src/app/provider.tsx`, `next.config.ts`, `package.json` (no dependency change), every prop type and
every test that asserts behaviour rather than styling.

**Structure Decision.** AGENTS.md's rules, followed exactly. This feature touches no route handler
logic and no Server Action, so it never crosses the `src/app` / `src/features/<feature>/server`
boundary the structure rules exist to protect. `src/components/shared/dialog-panel` is the one new
module, and it clears Principle I's two-call-site bar on day one of this feature rather than being
spun up speculatively — it consolidates eight existing call sites, it does not anticipate a ninth.

## Complexity Tracking

| Item | Why it needs recording | Why it's the right call, not a violation |
| --- | --- | --- |
| **`docs/product/specifications.md` §7 *Palette* is edited** | AGENTS.md's Authority section says the product specification is "silent on how," with sign-in's transport as the sole named exception — a reviewer could read an edit to that document as this feature overstepping its lane. | §7 *Palette* documents a shipped visual system after the fact (R1's palette landed, then §7 described it) rather than constraining this feature's design — it is documentation tracking code, not a product requirement this feature must satisfy or negotiate. Leaving it unedited would make it actively wrong the moment the new palette ships, which is a worse outcome than the edit. Per the user's memory constraint, the edit carries no version bump and no history-table row anywhere in this project. |
| **Dialog-shell extraction touches seven files under one new shared module** | Could look like this feature's scope growing beyond "change token values." | Every one of those seven files needs an edit anyway for the spacing/radius change (D-3, D-4) — the extraction makes that edit land once instead of seven times, which is Principle I's own two-call-site rule applied to a threshold the files had already crossed (D-6). |
| **`clsx` in `package.json` with no AGENTS.md table entry** | Gate 4 asks whether a new dependency was added without approval; a diff-only reviewer might flag it against this feature. | Pre-existing — not installed, touched, or newly relied upon by this feature. Recorded here so it reads as "known and out of scope" rather than "missed." |

## Phase status

| Phase | Output | Status |
| --- | --- | --- |
| 0 — Outline & research | [`research.md`](./research.md) | complete — 8 decisions, 6 assumptions carried forward, no unknown outstanding |
| 1 — Design & contracts | [`data-model.md`](./data-model.md), [`contracts/`](./contracts/), [`quickstart.md`](./quickstart.md) | complete |
| Constitution re-check | this file | complete — pass, three items in Complexity Tracking, none a principle violation |
| 2 — Tasks | [`tasks.md`](./tasks.md) | complete — 52 tasks, generated by a later `/speckit-tasks` run |
| Implementation | — | not started |
