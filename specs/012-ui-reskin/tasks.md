# Tasks: UI reskin to the Broadsheet design system

**Input**: Design documents from `specs/012-ui-reskin/`
**Prerequisites**: [`plan.md`](./plan.md), [`spec.md`](./spec.md), [`research.md`](./research.md) (decisions D-1…D-8), [`data-model.md`](./data-model.md), [`contracts/design-tokens.md`](./contracts/design-tokens.md), [`contracts/component-patterns.md`](./contracts/component-patterns.md), [`contracts/page-inventory.md`](./contracts/page-inventory.md), [`quickstart.md`](./quickstart.md)

**Tests**: This feature is presentation-only (FR-009) against an existing, already-tested codebase, so most tasks below carry no new automated test — the existing `globals.test.ts` and `theme-tokens.test.ts` contracts are the pre-existing Red/Green mechanism for token-*value* changes (research.md D-8). A new failing test IS required, and is called out explicitly, wherever a component's *class shape* changes: the token graph's own new WCAG pairing, the repo-wide `theme-tokens.test.ts` generalisation, the shared dialog-shell extraction, and the two literal-colour fixes (one already named in research.md D-7, one found during this task-generation pass — see Notes).

**Organization**: Phase 3–5 are grouped by user story (spec.md's P1/P2/P3) so each can be restyled, verified, and shipped independently, per `contracts/page-inventory.md`'s route grouping.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: US1 (sign-in/recovery), US2 (app shell), US3 (remaining pages) — maps to spec.md's User Story 1/2/3
- Every task names its exact file path(s)

---

## Phase 1: Setup

- [x] T001 Confirm the pre-restyle baseline is green: run `npm run verify` from the repository root and confirm `style-check`, `type-check`, `test` (zero skipped), and `build` all pass before any token or component change lands — this is the regression bar SC-002 and gate 8 measure every later phase against

**Checkpoint**: Baseline confirmed green. No dependency installs — this feature adds none (plan.md, Gate 4).

---

## Phase 2: Foundational (Blocking Prerequisites — the design-token graph)

**Purpose**: `src/app/globals.css`'s `@theme inline` block is the single place the entire palette, type, spacing, radius, and shadow graph lives (research.md, "What already exists"). Every user-facing surface in Phase 3–5 depends on this graph resolving correctly, so it must land, and its two contract tests must be green, before any page or component is restyled.

**⚠️ CRITICAL**: No Phase 3/4/5 restyle work can be verified as correct until this phase's checkpoint is reached.

### Tests for the token graph (Red step — research.md D-8.1, D-8.3)

- [x] T002 [P] In `src/app/globals.css`'s `controlBoundaryPairs` array (read by `src/app/globals.test.ts`), add the `--color-accent` (focus-ring) against `--color-accent-fill` (accent-filled control background) pairing named in `contracts/design-tokens.md`'s Non-negotiables table, plus any other new semantic pairing the Broadsheet ramp introduces; run `npx vitest run src/app/globals.test.ts` and observe the new row fail (the ramp behind it doesn't exist yet)
- [x] T003 [P] Generalise `src/features/projects/components/theme-tokens.test.ts`'s "every `var(--color-*)` a component names resolves in `globals.css`" pattern into one test that walks `src/features/*/components/**/*.tsx`, `src/app/**/*.tsx`, and `src/components/shared/**/*.tsx`, replacing the projects-only copy (Principle I; research.md D-8.3); run it and observe it fail against any pre-existing dangling token reference the wider glob turns up

### Implementation — the token graph

- [x] T004 In `src/app/globals.css`'s `@theme inline` block, replace the four role tokens (`--color-bg`, `--color-page`, `--color-surface`, `--color-text`), the two accent role tokens (`--color-accent`, `--color-accent-2`), and `--color-divider` with the Broadsheet cream-paper / clay-terracotta / ink-black values (data-model.md §Palette role token; FR-001)
- [x] T005 Recompute the nine-step `--color-neutral-100`…`900`, `--color-accent-100`…`900`, and `--color-accent-2-100`…`900` ramps in `src/app/globals.css` around the new role-token endpoints from T004 (data-model.md §Neutral ramp / accent ramp / accent-2 ramp)
- [x] T006 Re-point every existing semantic colour token in `src/app/globals.css` — `--color-surface-sunken`, `--color-border`, `--color-border-control`, `--color-border-strong`, `--color-text-muted`, `--color-text-placeholder`, `--color-text-disabled`, `--color-accent-fill`, `--color-accent-hover`, `--color-accent-pressed`, `--color-accent-text`, `--color-on-accent`, `--color-danger`, `--color-danger-fill`, `--color-danger-text`, `--color-success`, `--color-success-fill`, `--color-success-text`, `--color-advisory`, `--color-advisory-fill`, `--color-advisory-text` — at whichever new ramp step reproduces the same role; no token name changes (research.md D-1)
- [x] T007 In `src/app/globals.css`'s `@theme inline` block, route `--font-heading` and `--font-body` to `--font-source-serif`, keep `--font-sans` routed to `--font-archivo`, and add a new `--font-mono` token routed to `--font-mono-ui` (research.md D-2; contracts/design-tokens.md Rule 3; FR-002)
- [x] T008 Update the `--text-h1`…`--text-h6` and `--text-body` scale (and each step's line-height/letter-spacing/weight variables) in `src/app/globals.css` to the scale the serif needs at heading weight, keeping the same variable names (FR-002; data-model.md §Type step)
- [x] T009 Change `--spacing` from `4px` to `5px` in `src/app/globals.css`'s `@theme inline` block (research.md D-3; FR-003)
- [x] T010 Add a `--radius-sm` token (2–3px range) to `src/app/globals.css` and replace the base-layer `* { border-radius: 0 }` reset with `border-radius: var(--radius-sm)`, keeping `--radius-full` (`9999px`) for `rounded-full` elements; add `--radius-none` only if a Phase 3–5 sweep task finds an element that genuinely needs a hard-square opt-out (research.md D-4; data-model.md §Radius step; FR-003)
- [x] T011 [P] Retune `--shadow-sm`, `--shadow-md`, `--shadow-lg` values in `src/app/globals.css` to read correctly against the new paper background, adding no new shadow call site (research.md D-5; data-model.md §Shadow step)
- [x] T012 Run `npx vitest run src/app/globals.test.ts` and the generalised `theme-tokens.test.ts` from T003 and confirm both are green against the new token graph from T004–T011

**Checkpoint**: The token graph resolves and clears WCAG AA. Phase 3, 4, and 5 can now proceed (sequentially or in parallel with separate implementers).

---

## Phase 3: User Story 1 — Sign-in and account-recovery screens (Priority: P1) 🎯 MVP

**Goal**: Every screen a person sees before signing in — sign-in, forgot/reset password, accept invitation, and their error/locked/expired/used states — renders with the Broadsheet palette, typography, and spacing, with no change to what any control does.

**Independent Test**: Visit `/signin`, `/reset` (both request and token-dispatched forms), and `/invite/accept` directly (including error, locked, expired, and used-link states) without signing in; confirm the new look and that every existing action still works (quickstart.md §2).

### Implementation for User Story 1

- [x] T013 [P] [US1] Restyle `src/app/(auth)/layout.tsx` to the new token graph
- [x] T014 [P] [US1] Add a failing assertion to `src/app/(auth)/auth-showcase.test.tsx` that the two grid-line `backgroundImage` inline styles in `src/app/(auth)/auth-showcase.tsx` derive from `--color-text` (e.g. via `color-mix(in srgb, var(--color-text) …%, transparent)`, the pattern the same file already uses two lines below) rather than the literal `rgba(43,28,21,0.05)` / `rgba(43,28,21,0.09)` values shipping today; observe it fail, then edit `src/app/(auth)/auth-showcase.tsx` to make it pass — see Notes: this literal was not caught by research.md D-7's Tailwind-class grep and will not move when `--color-text` changes in T004
- [x] T015 [P] [US1] Restyle `src/app/(auth)/signin/page.tsx` and `src/features/auth/components/sign-in-form.tsx` to the new token graph, nudging any arbitrary pixel value that bypasses the 5px spacing scale to the nearest multiple (contracts/design-tokens.md Rule 4)
- [x] T016 [P] [US1] Restyle `src/app/(auth)/reset/page.tsx`, `src/features/auth/components/reset-request-form.tsx`, and `src/features/auth/components/change-password-form.tsx` to the new token graph, including the same arbitrary-pixel-value sweep
- [x] T017 [P] [US1] Restyle `src/app/(auth)/invite/accept/page.tsx` to the new token graph
- [x] T018 [P] [US1] Restyle `src/app/(auth)/error.tsx` (the auth route-group's error boundary) to the new token graph
- [x] T019 [P] [US1] Restyle the remaining shared auth components — `src/features/auth/components/email-field.tsx`, `password-field.tsx`, `banner.tsx`, `card-footer-note.tsx`, `back-to-sign-in-footer.tsx`, `must-change-password-banner.tsx`, `icons.tsx` — to the new token graph, including the arbitrary-pixel-value sweep
- [x] T020 [US1] Run `npx vitest run src/features/auth src/app/\(auth\)` and confirm every existing test (including `primary-button-classes.test.ts`, `card-footer-note.test.tsx`, `banner.test.tsx`, and T014's new assertion) is green
- [x] T021 [US1] Manual walkthrough per quickstart.md §2 — sign in, wrong credentials, locked account, forgot password, expired/used reset link, accept invitation, expired/used invitation — confirm the new palette/typography/spacing on each and that every existing action still works (spec.md Acceptance Scenarios 1–3)

**Checkpoint**: User Story 1 is fully restyled and independently shippable as the MVP slice.

---

## Phase 4: User Story 2 — The signed-in app shell (Priority: P2)

**Goal**: The navigation rail and header bar — present on every authenticated page — render with the new design system while continuing to take people to exactly the destinations they reach today.

**Independent Test**: Sign in and confirm the nav rail and header bar render with the new design system, and every existing nav destination and header control (search, profile, sign out) still functions (quickstart.md §3).

### Tests for User Story 2 (Red step — research.md D-7)

- [x] T022 [P] [US2] Add a failing assertion to `src/features/shell/components/toast-region.test.tsx` that both the `error` and `warning` entries in `toast-region.tsx`'s `KIND_CLASSES` map reference the product's semantic danger/advisory tokens (`--color-danger`/`--color-danger-fill` for `error`; the matching advisory pair for `warning`) rather than Tailwind's default `red-`/`amber-` classes; observe it fail, then edit `src/features/shell/components/toast-region.tsx` to make it pass — research.md D-7 names both the `error` and `warning` entries as the repo's only two non-token colour literals; T022 covers both

### Implementation for User Story 2

- [x] T023 [P] [US2] Restyle `src/app/(app)/layout.tsx` to the new token graph
- [x] T024 [P] [US2] Restyle `src/features/shell/components/app-shell.tsx` and `sidebar.tsx` to the new token graph — grouped navigation, hover/selected states, workspace mark — preserving the same destinations, counts, and collapse behaviour (FR-005)
- [x] T025 [P] [US2] Restyle `src/features/shell/components/project-list-region.tsx`, `screen-header.tsx`, `user-chip.tsx`, and `sign-out-control.tsx` to the new token graph
- [x] T026 [P] [US2] Restyle `src/features/shell/components/connection-banner.tsx`, `forbidden-notice.tsx`, and `not-found-notice.tsx` to the new token graph
- [x] T027 [P] [US2] Restyle `src/app/(app)/forbidden.tsx`, `src/app/(app)/not-found.tsx`, and the root `src/app/not-found.tsx` (outside either route group) to the new token graph (spec.md Edge Cases; contracts/page-inventory.md)
- [x] T028 [US2] Run `npx vitest run src/features/shell` and confirm every existing test, including T022's new assertion, is green
- [x] T029 [US2] Manual walkthrough per quickstart.md §3 — sidebar items and order, hover/selected states, header search/action controls, sign-out — confirm the restyle and that FR-005's information architecture is unchanged (spec.md Acceptance Scenarios 1–3)

**Checkpoint**: User Stories 1 and 2 are both restyled and independently functional.

---

## Phase 5: User Story 3 — Home, Notifications, Profile, and the remaining pages (Priority: P3)

**Goal**: Every remaining existing page — Home, Notifications, Profile, a project's board and details, an issue's detail and creation forms, the new-project form, and the Accounts and Labels settings screens — renders with the new design system, completing SC-001.

**Independent Test**: Visit each page directly and confirm its content is restyled while every existing action on it (viewing notifications, editing a profile field, moving a board card, creating an issue or project, managing accounts or labels) still works (quickstart.md §4).

### Tests for User Story 3 (Red step — research.md D-6)

- [x] T030 [P] [US3] Create a failing test (e.g. `src/components/shared/dialog-panel.test.ts`) asserting a new shared export produces the class string `"flex w-full max-w-[420px] flex-col gap-[15px] bg-(--color-bg) p-4 shadow-lg"` (and the `gap-[10px]` variant, unchanged — already a 5px multiple) — the 5px-multiple-corrected value per research.md D-3, not the `gap-[14px]` literal the eight call sites below hard-code today; observe it fail because `src/components/shared/dialog-panel.(ts|tsx)` doesn't exist yet, then create that module to make it pass (research.md D-3, D-6; contracts/component-patterns.md §Dialogs)

### Implementation — dialog-shell extraction (depends on T030)

- [x] T031 [P] [US3] Update `src/features/projects/components/delete-column-dialog.tsx` to consume the shared dialog shell from T030 instead of its hard-coded literal; confirm its own copy, fields, and destructive action are unchanged
- [x] T032 [P] [US3] Update `src/features/projects/components/delete-project-control.tsx` to consume the shared dialog shell from T030
- [x] T033 [P] [US3] Update `src/features/labels/components/delete-label-dialog.tsx` to consume the shared dialog shell from T030
- [x] T034 [P] [US3] Update `src/features/labels/components/label-form-modal.tsx` to consume the shared dialog shell from T030
- [x] T035 [P] [US3] Update `src/features/accounts/components/roster-table.tsx`'s two dialog call sites to consume the shared dialog shell from T030
- [x] T036 [P] [US3] Update `src/features/accounts/components/invite-modal.tsx` to consume the shared dialog shell from T030
- [x] T037 [P] [US3] Update `src/features/issues/components/delete-issue-control.tsx` to consume the shared dialog shell from T030

### Implementation — remaining page and component sweeps

- [x] T038 [P] [US3] Restyle `src/app/(app)/home/page.tsx` and `src/features/home/components/*.tsx` to the new token graph — empty and populated states, card/list treatment per the hairline-not-fill convention (research.md D-5)
- [x] T039 [P] [US3] Restyle `src/app/(app)/notifications/page.tsx` and `src/features/notifications/components/*.tsx` to the new token graph
- [x] T040 [P] [US3] Restyle `src/app/(app)/profile/page.tsx` and `src/features/profile/components/*.tsx` to the new token graph
- [x] T041 [P] [US3] Restyle `src/app/(app)/projects/[projectKey]/page.tsx` (board) and `src/features/board/components/*.tsx` to the new token graph
- [x] T042 [P] [US3] Restyle `src/app/(app)/projects/[projectKey]/details/page.tsx`, `src/app/(app)/projects/new/page.tsx`, and the remaining `src/features/projects/components/*.tsx` not already touched by T031/T032 to the new token graph
- [x] T043 [P] [US3] Restyle `src/app/(app)/projects/[projectKey]/issues/new/page.tsx`, `src/app/(app)/projects/[projectKey]/issues/[issueNumber]/details/page.tsx`, and the remaining `src/features/issues/components/*.tsx` not already touched by T037 to the new token graph
- [x] T044 [P] [US3] Restyle `src/features/activity/components/*.tsx` (used by Home's activity row, project details, and issue detail) to the new token graph
- [x] T045 [P] [US3] Restyle `src/app/(app)/settings/accounts/page.tsx` and every `src/features/accounts/components/*.tsx` file to the new token graph, including `roster-table.tsx`'s `<table>` markup — row-separator, header-face, and mono-value-cell treatment (contracts/component-patterns.md §Tables) — excluding only `roster-table.tsx`'s two `Dialog` call sites and all of `invite-modal.tsx`, already restyled by T035 and T036
- [x] T046 [P] [US3] Restyle `src/app/(app)/settings/labels/page.tsx` and the remaining `src/features/labels/components/*.tsx` not already touched by T033/T034 to the new token graph
- [x] T047 [US3] Run `npx vitest run src/features/home src/features/notifications src/features/profile src/features/board src/features/projects src/features/issues src/features/activity src/features/accounts src/features/labels src/components/shared` and confirm every existing test, including T030's new assertion, is green
- [x] T048 [US3] Manual walkthrough per quickstart.md §4 and §5 and `contracts/page-inventory.md`'s User Story 3 table — confirm each page's palette/typography/spacing and exercise its one named interaction (view a notification, edit a profile field, move a board card, create an issue, create a project, manage an account, manage a label); also open each of the eight dialogs from T031–T037 and confirm the shared shell merged no dialog's content, and complete §5's keyboard-focus, reduced-motion, and long-content checks (spec.md Acceptance Scenarios 1–4)

**Checkpoint**: All three user stories are independently functional. SC-001's 22-route-file checklist is fully covered.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [x] T049 [P] Update `docs/product/specifications.md` §7 *Palette* to describe the shipped Broadsheet values — documentation only, no version bump and no history-table row (research.md *Assumptions carried forward*)
- [x] T050 [P] Confirm every `rounded-full` element (dots, spinners, the roster avatar placeholder) is still circular under the new base radius default from T010 (data-model.md §Radius step validation rule)
- [x] T051 Run the grep validation from quickstart.md §1: `grep -rn "#ec3013\|#e15b47\|#f3f2f2" src --include="*.css" --include="*.tsx"` returns no hits (FR-001), and `grep -n "prefers-color-scheme" src/app/globals.css` returns no hits (no dark theme introduced)
- [x] T052 Run `npm run verify` (style-check → type-check → test → build) and confirm every check is green with zero skipped tests (gates 5 and 8; SC-002)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately.
- **Foundational (Phase 2)**: Depends on Setup. BLOCKS every user story — no page or component restyle can be verified correct until `globals.css`'s token graph (T004–T011) is in place and its two contract tests (T002, T003 via T012) are green.
- **User Stories (Phase 3–5)**: All depend on Foundational completion (T012). They do not depend on each other and may proceed in parallel by different implementers, or sequentially in priority order (P1 → P2 → P3).
- **Polish (Phase 6)**: Depends on all three user stories being complete (T048).

### Within Each User Story

- Where a class-shape change is introduced (T014's auth-showcase fix, T022's toast-region fix, T030's dialog-shell extraction), the failing test is written and observed failing before the corresponding implementation task.
- T031–T037 (seven tasks covering the eight dialog call sites) depend on T030 (the shared module must exist first) but not on each other.
- Each story's "run tests" task depends on every restyle task in that story; each story's manual-walkthrough task is last.

### Parallel Opportunities

- T002 and T003 (the two Foundational Red-step tests) run in parallel.
- T011 runs in parallel with T004–T010 (different concern within the same file — coordinate on `globals.css` edits landing in one commit).
- Once Foundational (T012) is done, Phase 3, 4, and 5 can start in parallel if staffed separately.
- Within Phase 3: T013–T019 (7 tasks) touch disjoint files and run in parallel.
- Within Phase 4: T023–T027 (5 tasks) touch disjoint files and run in parallel; T022 runs in parallel with them.
- Within Phase 5: T031–T037 (7 tasks) run in parallel once T030 lands; T038–T046 (9 tasks) touch disjoint files and run in parallel with each other and with T031–T037.

---

## Parallel Example: User Story 3's dialog-shell extraction

```bash
# After T030 (shared module + its failing test) lands:
Task: "Update delete-column-dialog.tsx to consume the shared dialog shell"
Task: "Update delete-project-control.tsx to consume the shared dialog shell"
Task: "Update delete-label-dialog.tsx to consume the shared dialog shell"
Task: "Update label-form-modal.tsx to consume the shared dialog shell"
Task: "Update roster-table.tsx's two dialog call sites to consume the shared dialog shell"
Task: "Update invite-modal.tsx to consume the shared dialog shell"
Task: "Update delete-issue-control.tsx to consume the shared dialog shell"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup.
2. Complete Phase 2: Foundational — the token graph (CRITICAL, blocks every story).
3. Complete Phase 3: User Story 1 (sign-in and recovery).
4. **STOP and VALIDATE**: run quickstart.md §2 and `npm run verify`. Sign-in and recovery are shippable on their own — they are architecturally self-contained (spec.md, "Why this priority").

### Incremental Delivery

1. Setup + Foundational → the token graph is live and WCAG-proven.
2. Add User Story 1 → validate independently → shippable (MVP).
3. Add User Story 2 → validate independently → shippable (shell now matches, wraps all pages).
4. Add User Story 3 → validate independently → shippable (SC-001 fully closed).
5. Polish → documentation, radius/grep validation, full `npm run verify`.

### Parallel Team Strategy

With multiple implementers: complete Setup + Foundational together first (it is a single shared file, `globals.css`, so this phase itself is not a good parallel-team target). Once Foundational is done, one implementer per user story (Phase 3, 4, 5) can proceed independently, since the three stories touch disjoint route/component trees per `contracts/page-inventory.md`.

---

## Notes

- **One finding surfaced during this task-generation pass, not present in research.md/plan.md, is folded into T014 above rather than left for implementation time to discover:** `src/app/(auth)/auth-showcase.tsx` (the decorative auth-shell background named in FR-010) hard-codes two `rgba(43,28,21, …)` values in inline `style={{ backgroundImage: … }}` props — literal instances of the *current* ink-black text colour that will not move when `--color-text` is repointed in T004, and that research.md D-7's Tailwind-class grep could not have caught since it is not a Tailwind class at all. T014 fixes this.
- [P] tasks touch different files with no dependency on each other.
- [Story] labels map each Phase 3–5 task to spec.md's User Story 1/2/3 for traceability (Gate 7).
- No test framework, icon library, or other dependency is added anywhere in this task list (Gate 4) — every task edits existing files or adds one new module (`src/components/shared/dialog-panel`) already justified in plan.md's Project Structure.
- Verify each new test fails for the stated reason before writing the implementation that makes it pass (Gate 1).

---

## Phase 7: Convergence

- [x] T053 Give `--color-surface-hover` a real declaration in `src/app/globals.css`'s `@theme inline` block (or repoint each call site to an existing hover token) so the `data-[hovered]:bg-(--color-surface-hover)` classes in `src/features/board/components/grouping-control.tsx` (two call sites), `src/features/activity/components/mention-picker.tsx`, and `src/features/projects/components/add-column-form.tsx` actually resolve instead of silently applying no hover background, then drop `--color-surface-hover` from `theme-tokens.test.ts`'s `PRE_EXISTING_REPO_WIDE_GAPS` allowlist so the repo-wide token-resolution contract (contracts/design-tokens.md Rule 2) truly enforces it per FR-007 (contradicts)
- [x] T054 Nudge the spacing values left off the 5px scale to their nearest multiple: `gap-[14px]` → `gap-[15px]` in `src/features/accounts/components/invite-modal.tsx` and `src/features/labels/components/label-form-modal.tsx`; `gap-[6px]` → `gap-[5px]` (both instances in `invite-modal.tsx`); `gap-[8px]` → `gap-[10px]` in `invite-modal.tsx`, `src/features/issues/components/delete-issue-control.tsx`, `src/features/labels/components/delete-label-dialog.tsx`, `src/features/projects/components/delete-column-dialog.tsx`, and `src/features/projects/components/delete-project-control.tsx`; and `py-[11px]` → `py-[10px]` in `src/features/shell/components/connection-banner.tsx` per FR-003 (partial)

---

## Phase 8: Convergence

- [x] T055 Nudge the spacing values left off the 5px scale to their nearest multiple: `gap-[9px]` → `gap-[10px]`, `px-[14px]` → `px-[15px]`, and `py-[11px]` → `py-[10px]` in `src/features/auth/components/primary-button-classes.ts` (the shared primary-button class builder used across every restyled surface with a primary action, including the P1 sign-in/recovery screens); and `py-[11px]` → `py-[10px]` in `src/features/shell/components/toast-region.tsx` per FR-003 (partial)
