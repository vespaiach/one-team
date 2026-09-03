# Tasks: Labels

**Input**: Design documents from [`specs/007-labels-management/`](.)

**Prerequisites**: [`plan.md`](./plan.md), [`spec.md`](./spec.md), [`research.md`](./research.md),
[`data-model.md`](./data-model.md), [`contracts/`](./contracts/), [`quickstart.md`](./quickstart.md) —
all reconciled with the product specification's Modernist design system (no `label.color`, no palette
of any kind in this feature).

**Tests**: **required, and written first.** Principle VII is non-negotiable in this repository and
change gate 1 asks for a test that was observed failing before its implementation. Every
implementation task below names the test task that must be Red before it starts.

**Organization**: by user story, in the spec's priority order. Each story is independently testable
against the *Independent Test* its phase states.

---

## Precondition — entries R2, R5, R6 are implemented; R7 is not

Unlike this plan's original writing, **R2, R5 and R6 are now implemented**: the shell's **Labels**
sidebar entry and the guard-only `/settings/labels` page (R2) already exist and are already tested
(`src/features/shell/components/sidebar.test.tsx`); `project`, `project_member`, `isMember`, `isAdmin`
(R5, at `src/features/projects/server/authorization.ts`); `issue`, the issue rail, Create issue form,
and `createIssue` (R6). No task below re-builds any of that — each names the existing file it edits.

**R7 — Comments and activity feeds — is not implemented.** No `activity` table, no `writeActivity`
function exist in code, and R7's own landed plan pins `writeActivity`'s signature without yet admitting
`label_added` / `label_removed` in its `type` union. Per the explicit, user-approved scope for this
implementation: **every requirement except `FR-021`'s two activity-write side effects is implemented in
full**, including `addIssueLabel` and `removeIssueLabel`'s own core write and idempotency, which do not
depend on the activity call. The two activity-write tasks (`T045`, `T046`) stay open — not marked
`[X]`, not stubbed, not faked — until R7 lands. This is not an oversight; it is the plan's own recorded
Complexity Tracking decision, confirmed with the user before this file was written.

```bash
git log --oneline -1 -- src/features/issues/server/create-issue.ts
git log --oneline -1 -- src/features/projects/server/authorization.ts
```

Both non-empty confirms R6 and R5 have landed, matching what this file assumes.

---

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel — different files, no dependency on an incomplete task
- **[Story]**: `[US1]` or `[US2]`, mapping to the spec's two user stories
- Every task names the file it touches and the requirement that puts it there

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: confirm the two reconciliation points [`quickstart.md`](./quickstart.md) calls out before
any code is written.

- [X] T001 Run both precondition checks above, then reconcile against what they show: (1) confirm
      `src/features/issues/server/create-issue.ts`'s `CreateIssueInput` is still a plain object this
      feature can add an optional `labelIds` field to without restructuring the mutator; (2) confirm
      R7's `writeActivity` (in [`specs/007-comments-activity-feeds/contracts/mutators.md`](../007-comments-activity-feeds/contracts/mutators.md))
      still lives at `src/features/activity/server/write-activity.ts`, still does not exist in code, and
      its `type` union still does not admit `label_added` / `label_removed` — record any drift found
      here before Phase 2 starts (quickstart.md, *Reconcile before implementing*, research C-6)

      **Reconciled 2026-09-03, no drift.** Both precondition checks are non-empty (`3e8fceb` for
      `create-issue.ts`, `6ffa32a` for `authorization.ts`). (1) `CreateIssueInput` at
      `src/features/issues/server/create-issue.ts:21-30` is still a plain object literal type
      (`projectId`, `actor`, `title`, `description`, `columnId`, `priority`, `assigneeId`, `dueDate`) —
      an optional `labelIds: unknown` field can be added to it without restructuring `createIssue`. (2)
      `src/features/activity/` does not exist anywhere in the tree — `write-activity.ts` still does not
      exist in code. `specs/007-comments-activity-feeds/contracts/mutators.md` still pins `writeActivity`
      at `src/features/activity/server/write-activity.ts` with `type` restricted to `"created" |
      "field_changed" | "member_added" | "member_removed" | "archived" | "reopened" | "comment"` — no
      `label_added` / `label_removed`. `src/features/labels/` also does not exist yet, and
      `src/db/schema.ts` has no `label` or `issue_label` table, both consistent with Phase 2 not having
      started. Everything this file and quickstart.md assume is still current.

**On gate 1 for this phase.** T001 adds no behaviour of its own — a verification step, not an
implementation. No test is written for it and none is skipped.

**Checkpoint**: both reconciliation points confirmed current.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: the two tables every story writes to or reads from.

**⚠️ CRITICAL**: no user story work can begin until this phase is complete.

- [X] T002 [P] Write the failing shape and bound tests in `src/db/label-constraints.test.ts`, against
      the real PostgreSQL instance `TEST_DATABASE_URL` names: a name of exactly 200 characters accepted
      and 201 refused; `name` refused when null; two labels named identically except for case refused
      by the unique index — created through two concurrent connections, asserting exactly one succeeds
      (FR-006, FR-007, research A-5, A-6, E-1)
- [X] T003 [P] Write the failing composite-key and cascade tests in
      `src/db/issue-label-constraints.test.ts`: inserting the same `(issue_id, label_id)` pair twice is
      refused by the primary key; deleting the referenced issue removes its `issue_label` rows;
      deleting the referenced label removes its `issue_label` rows — each cascade asserted from a
      second connection outside the transaction that ran the delete (FR-012, FR-022, data-model.md §2,
      §4, research A-2, A-3)
- [X] T004 Implement `label` and `issue_label` in `src/db/schema.ts`, appended after R6's `issue` per
      [`data-model.md`](./data-model.md) §1–2 — `label`: UUIDv7 key, `name` with its 200-character
      `CHECK` and `uniqueIndex("label_name_lower_idx").on(sql\`lower(name)\`)`, `createdAt`/`updatedAt`;
      `issue_label`: composite `(issueId, labelId)` primary key, both foreign keys `ON DELETE CASCADE`,
      and `index("issue_label_label_id_idx").on(labelId)` — no `color` column on `label`, no
      `deletedAt`, no synthetic id or timestamps on `issue_label` (FR-006, FR-007, FR-012, FR-019,
      FR-022, research A-1…A-4) — makes T002, T003 green
- [X] T005 Run `npm run db:generate`, read the generated SQL to confirm both `CHECK`s, the functional
      unique index, the composite primary key and both `ON DELETE CASCADE` foreign keys are present
      exactly as written, and commit the migration with its metadata (`AGENTS.md` → Drizzle) — depends
      on T004

      **Done 2026-09-03.** `drizzle/0005_mature_typhoid_mary.sql` generated and inspected: one `CHECK`
      (`label_name_length`, `char_length("label"."name") <= 200` — `data-model.md` §1 lists exactly one
      `CHECK` on this table), the functional unique index (`label_name_lower_idx` on `lower("name")`),
      the composite primary key (`issue_label_issue_id_label_id_pk` on `(issue_id, label_id)`), and both
      `ON DELETE CASCADE` foreign keys (`issue_label_issue_id_issue_id_fk`,
      `issue_label_label_id_label_id_fk`) plus `issue_label_label_id_idx` are all present exactly as
      `data-model.md` §1–2 specifies.
- [X] T006 [P] Add `"issue_label"` and `"label"` to `TRUNCATED_TABLES` in `src/db/test-database.ts`,
      immediately after `"issue"` (research E-2)

**On gate 1 for this phase.** T006 adds no behaviour of its own, proved by every persistence test from
T007 onward. No test is written for it and none is skipped.

**Checkpoint**: both tables exist with every invariant the database owns. User story implementation can
begin.

---

## Phase 3: User Story 1 — An admin curates the team-wide label set (Priority: P1) 🎯 MVP

**Goal**: `/settings/labels` lists every label alphabetically with its usage count; an admin creates,
renames and deletes labels through one modal and one confirmation dialog.

**Independent Test**: sign in as an admin, open `/settings/labels` with no labels yet, create one with
a name, and confirm it appears in the alphabetical list with a usage count of zero. Rename it and
confirm the new name shows immediately. No other story needs to exist.

### Tests for User Story 1 (write first, observe failing) ⚠️

- [X] T007 [P] [US1] Write the failing query tests in `src/features/labels/server/queries.test.ts`:
      `listLabelsWithUsage` returns every label alphabetical by `lower(name)`, each carrying the real
      `COUNT(*)` of its `issue_label` rows across every project; `checkLabelNameAvailable` returns the
      holder `{ id, name }` on a case-insensitive match and `null` otherwise (FR-003, FR-007,
      data-model.md §3)
- [X] T008 [P] [US1] Write the failing tests in `src/features/labels/server/create-label.test.ts`:
      `isAdmin` required, a non-admin refused; a trimmed, non-empty, `<= 200`-character name accepted; a
      name matching an existing label case-insensitively refused with the holder named, never
      suffixed; two admins creating the same name concurrently on two separate connections — exactly
      one succeeds, refused by the unique index rather than the pre-check (FR-001, FR-006, FR-007,
      FR-008, research C-3)
- [X] T009 [P] [US1] Write the failing tests in `src/features/labels/server/update-label.test.ts`:
      `isAdmin` required; renaming to the label's own current name is not a clash; renaming to another
      label's name (case-insensitive) is refused with that label named; a missing id returns
      `not_found`; the label row's `updated_at` changes through `touched()`, no other row changes
      (FR-009, FR-010)
- [X] T010 [P] [US1] Write the failing tests in `src/features/labels/server/delete-label.test.ts`:
      `isAdmin` required; deleting a label carried by N issues returns `removedFromIssueCount: N`,
      matching a fresh `COUNT(*)` read inside the same transaction; every `issue_label` row naming it is
      gone and the N issues themselves are otherwise unchanged, asserted from a second connection so no
      intermediate state is observed; a label carried by zero issues deletes with `removedFromIssueCount: 0`
      and no confirmation-count special case in the mutator itself (FR-011, FR-012, research C-4)
- [X] T011 [P] [US1] Write the failing no-activity tests in
      `src/features/labels/server/no-activity.test.ts`: creating, renaming and deleting a label — one
      carrying issues — writes no row to any issue's or project's activity history; the module reachable
      from these three mutators imports nothing from an activity writer (FR-013)
- [X] T012 [P] [US1] Write the failing screen tests in
      `src/features/labels/components/labels-screen.test.tsx`: zero labels renders the single line "No
      labels yet" in place of a table; one or more labels renders a row per label showing its name and
      issue count, each with **Edit** and **Delete** controls, plus a **New label** control at the
      page's head (FR-003, FR-004, FR-005)
- [X] T013 [P] [US1] Write the failing modal tests in
      `src/features/labels/components/label-form-modal.test.tsx`: with no `label` prop, the name field
      is empty and submitting calls `createLabel`; with a `label` prop, the field is pre-populated and
      submitting calls `updateLabel`; on-blur validation against `checkLabelNameAvailable` reports a
      clash inline naming the holder without submitting; Escape or Cancel closes and discards, calling
      neither mutator; the submit control stays enabled through an invalid or clashing name and disables
      only while its own request is in flight (FR-006, FR-007, FR-008, FR-009, research C-2, D-2)
- [X] T014 [P] [US1] Write the failing dialog tests in
      `src/features/labels/components/delete-label-dialog.test.tsx`: with `issueCount > 0` the body
      reads exactly "It will be removed from {n} issues. This can't be undone."; with `issueCount === 0`
      the same confirmation without the count clause; Confirm calls `deleteLabel` and the dialog closes
      on success; Cancel and Escape close without calling it, and focus returns to the row's Delete
      control (FR-011, research D-3)
- [X] T015 [P] [US1] Write the failing route test in `src/app/(app)/settings/labels/page.test.ts`: an
      admin sees the rendered list (or the empty line); a non-admin sees Forbidden; the guard runs
      before the query (FR-001, research D-1, D-7)

### Implementation for User Story 1

- [X] T016 [US1] Implement `listLabelsWithUsage` and `checkLabelNameAvailable` in
      `src/features/labels/server/queries.ts` (FR-003, FR-007, data-model.md §3) — depends on T004,
      makes T007 green
- [X] T017 [US1] Implement `createLabel` in `src/features/labels/server/create-label.ts` —
      `isAdmin`, the three server-side validations, one `label` insert inside one transaction, returning
      `LabelView` with `issueCount: 0` or the named `duplicate_name` refusal
      ([`contracts/mutators.md`](./contracts/mutators.md) `createLabel`) — depends on T016, makes T008
      green
- [X] T018 [US1] Implement `updateLabel` in `src/features/labels/server/update-label.ts` — `isAdmin`,
      the same two validations with the clash check excluding the label's own row, one update through
      `touched()` ([`contracts/mutators.md`](./contracts/mutators.md) `updateLabel`) — depends on T016,
      makes T009 green
- [X] T019 [US1] Implement `deleteLabel` in `src/features/labels/server/delete-label.ts` — `isAdmin`,
      one transaction reading `COUNT(*) FROM issue_label WHERE label_id = $1` and then deleting the
      `label` row, relying on the database's `ON DELETE CASCADE` for `issue_label` rather than a second
      statement ([`contracts/mutators.md`](./contracts/mutators.md) `deleteLabel`, research C-4) —
      depends on T004, makes T010, T011 green
- [X] T020 [US1] Export `createLabel`, `updateLabel`, `deleteLabel` from
      `src/features/labels/actions.ts` under one top-level `"use server"`, each starting with
      `assertSameOrigin` and `requireActor`, and each revalidating `/settings/labels` on success
      ([`contracts/mutators.md`](./contracts/mutators.md) *Shared rules*) — depends on T017, T018, T019
- [X] T021 [P] [US1] Implement `src/features/labels/components/label-row.tsx` — name, issue count, Edit
      and Delete controls (FR-005) — makes part of T012 green
- [X] T022 [US1] Implement `src/features/labels/components/label-form-modal.tsx` as one `"use client"`
      React Aria `Dialog`, an optional `label` prop choosing Create vs. Edit, submitting through
      `useActionState` (FR-006, FR-007, FR-008, FR-009, research C-2, D-2) — depends on T020, makes T013
      green
- [X] T023 [US1] Implement `src/features/labels/components/delete-label-dialog.tsx` as a React Aria
      `AlertDialog`, mirroring `src/features/issues/components/delete-issue-control.tsx`'s structure,
      with the real `issueCount`-driven sentence (FR-011, research D-3) — depends on T020, makes T014
      green
- [X] T024 [US1] Implement `src/features/labels/components/labels-screen.tsx` — synchronous, the empty
      line or the table of `LabelRow`s, the `NewLabelButton` opening `LabelFormModal` with no `label`
      prop (FR-003, FR-004, research D-1) — depends on T021, T022, T023, makes the remainder of T012
      green
- [X] T025 [US1] Fill `src/app/(app)/settings/labels/page.tsx` — keep the existing `requireActor()` and
      `isAdmin` guard, replace the placeholder `notFound()` with `listLabelsWithUsage()` wrapped in
      `Suspense`, rendering `LabelsScreen` (FR-001, research D-1, D-7) — depends on T016, T024, makes
      T015 green
- [X] T026 [US1] Refactor with the tests green across `create-label.ts`, `update-label.ts`,
      `delete-label.ts`, `queries.ts` and the four components: no comment added, no dead code, and the
      two curation queries stay inline rather than extracted (gates 2, 6; Principle I)

**Checkpoint**: US1 is fully functional and testable on its own. Labels can be created, renamed and
deleted from `/settings/labels`; nothing yet applies one to an issue.

---

## Phase 4: User Story 2 — A project member labels an issue (Priority: P2)

**Goal**: the issue rail and Create issue form both offer the shared label picker; a member adds and
removes labels on an existing issue and sets them at creation time.

**Independent Test**: with at least one label already created (US1) and an issue that carries none,
sign in as a member of that issue's project, open the issue, add a label from the rail's picker, and
confirm it appears on the issue immediately. Remove it and confirm it is gone.

### Tests for User Story 2 (write first, observe failing) ⚠️

- [X] T027 [P] [US2] Write the failing tests in `src/features/labels/server/queries.test.ts` (extending
      T007's file): `listLabelOptionsForIssue(issueId)` returns every team label with `applied: true`
      only for the ones a `LEFT JOIN` against that issue's `issue_label` rows matches; called with no
      `issueId` (Create issue's case), every option comes back `applied: false` (FR-015, FR-016, FR-017,
      data-model.md §3)
- [X] T028 [P] [US2] Write the failing tests in `src/features/labels/server/issue-labels.test.ts`:
      `addIssueLabel` requires `isMember` derived from the issue's own stored `project_id`, never from a
      client-supplied value; a non-member is refused; adding a label already present is a no-op that
      still returns `{ ok: true, applied: true }` and inserts no second row; an unknown `labelId` is
      refused by name rather than throwing (FR-019, FR-020, FR-022, research C-1, C-5)
- [X] T029 [P] [US2] Write the failing concurrency test in
      `src/features/labels/server/issue-labels-race.test.ts`: two `addIssueLabel` calls for the same
      issue and label on **two separate `postgres` connections** — the table holds exactly one row
      afterward and neither call raises, proving `ON CONFLICT DO NOTHING` under real concurrency rather
      than one connection's serialized queue (FR-022, research C-5, quickstart.md *What a browser cannot
      show you*)
- [X] T030 [P] [US2] Write the failing tests in `src/features/labels/server/issue-labels.test.ts`
      (extending T028's file) for `removeIssueLabel`: the same `isMember` derivation; removing a label
      not present is a no-op returning `{ ok: true, applied: false }` and matches zero rows without
      raising (FR-019, FR-020, FR-022, research C-5)
- [X] T031 [P] [US2] Write the failing tests in
      `src/features/labels/components/label-picker-field.test.tsx`: every team label renders with its
      applied state as a checked selection; toggling reports the selection change to the caller; "Manage
      labels" links to `/settings/labels` and renders only when `role === 'admin'`, absent — not
      disabled — otherwise (FR-015, FR-016, FR-017, FR-018, research D-4, D-6)
- [X] T032 [P] [US2] Write the failing rail tests, extending `src/features/issues/components/issue-rail.test.tsx`:
      the rail renders `LabelPickerField` as a fifth control; toggling a label calls `addIssueLabel` or
      `removeIssueLabel` immediately, applied optimistically and rolled back with a toast on refusal; for
      a non-member the field renders disabled with the rail's own inline reason and no mutator is called
      (FR-015, FR-019, research D-4)
- [X] T033 [P] [US2] Write the failing form tests, extending
      `src/features/issues/components/create-issue-form.test.tsx`: the form renders `LabelPickerField`
      between Priority and Assignee; toggling a label updates local selection only, calling no mutator;
      on submit, every selected label id rides inside the `createIssue` call (FR-016, research D-4)
- [X] T034 [P] [US2] Write the failing tests, extending
      `src/features/issues/server/create-issue.test.ts` and `create-issue-defaults.test.ts`: `createIssue`
      accepts an optional `labelIds: unknown`; a valid array inserts one `issue_label` row per id in the
      same transaction as the `issue` insert; an id naming no existing label is refused, named, and
      writes nothing; omitting the field creates an issue with no labels, unchanged from before this
      feature (FR-016, contracts/screens.md *What this feature wires into R6's screens*)

### Implementation for User Story 2

- [X] T035 [US2] Implement `listLabelOptionsForIssue` in `src/features/labels/server/queries.ts` (FR-015,
      FR-016, FR-017, data-model.md §3) — depends on T016, makes T027 green
- [X] T036 [US2] Implement `addIssueLabel` and `removeIssueLabel` in
      `src/features/labels/server/issue-labels.ts` — `isMember` derived from the issue's stored
      `project_id`, the label resolved by id (refusing an unknown one by name), one
      `INSERT … ON CONFLICT (issue_id, label_id) DO NOTHING` / one `DELETE`, each inside one transaction,
      revalidating the issue's own detail path. **No activity write in this task** — see T045, T046
      below ([`contracts/mutators.md`](./contracts/mutators.md) `addIssueLabel`, `removeIssueLabel`,
      research C-1, C-5, C-7) — depends on T004, makes T028, T029, T030 green
- [X] T037 [US2] Export `addIssueLabel` and `removeIssueLabel` from `src/features/labels/actions.ts`,
      alongside the three US1 exports, each starting with `assertSameOrigin` and `requireActor` — depends
      on T036
- [X] T038 [P] [US2] Implement `src/features/labels/components/label-picker-field.tsx` as a `"use client"`
      presentational `ListBox` with `selectionMode="multiple"`, no commit logic of its own, taking
      `options`, `onToggle` and `canManageLabels` (FR-015, FR-016, FR-017, FR-018, research D-4, D-5, D-6)
      — makes T031 green
- [X] T039 [US2] Wire `LabelPickerField` into `src/features/issues/components/issue-rail.tsx` as a fifth
      control, each toggle calling `addIssueLabelAction` or `removeIssueLabelAction` inside the same
      `useOptimistic`/`useTransition` pattern the four existing controls already use, rolled back with
      `showToast` on refusal, disabled with the rail's existing `writeReason` for a non-member (FR-015,
      FR-019, research D-4) — depends on T035, T037, T038, makes T032 green
- [X] T040 [US2] Extend `CreateIssueInput` and `createIssue` in
      `src/features/issues/server/create-issue.ts` with an optional `labelIds: unknown` field — validated
      against `label` rows that actually exist, inserting the matching `issue_label` rows inside the same
      transaction as the `issue` insert, immediately after it (FR-016, contracts/screens.md) — depends on
      T004, makes T034 green
- [X] T041 [US2] Thread `labelIds` through `src/features/issues/actions.ts`'s `createIssue` form action
      via `formData.getAll("labelIds")` — depends on T040
- [X] T042 [US2] Wire `LabelPickerField` into
      `src/features/issues/components/create-issue-form.tsx` between Priority and Assignee, as local
      component state rendered into the submission as one hidden `<input name="labelIds">` per selected
      id (FR-016, research D-4) — depends on T035, T038, T041, makes T033 green
- [X] T043 [US2] Refactor with the tests green across `issue-labels.ts`, `queries.ts`,
      `label-picker-field.tsx`, `issue-rail.tsx`, `create-issue-form.tsx` and `create-issue.ts`: no
      comment added, no dead code, `LabelPickerField` still holds no commit logic of its own (gates 2, 6;
      Principle I)

**Checkpoint**: US1 and US2 both work independently. Labels can be created and applied to issues, at
the rail and at creation. `FR-021`'s activity rows are the only requirement not yet met.

### The one open requirement — `FR-021`, blocked on R7

- [X] T044 Confirm R7 is still not implemented (`git log --oneline -1 -- src/features/activity` returns
      nothing) before attempting T045 or T046 — if R7 has landed, re-read
      [`specs/007-comments-activity-feeds/contracts/mutators.md`](../007-comments-activity-feeds/contracts/mutators.md)'s
      `writeActivity` signature first, since T045 and T046 assume it now admits `label_added` /
      `label_removed`
- [ ] T045 [US2] **Not started — blocked on R7.** Write the failing test that `addIssueLabel` writes one
      `activity` row `{ issueId, actorId: actor.id, type: 'label_added', toValue: label.name }` only
      when its insert actually added a row, then add the `writeActivity(tx, …)` call inside
      `addIssueLabel`'s existing transaction in `src/features/labels/server/issue-labels.ts` (FR-021,
      research C-6) — depends on T044 confirming R7 exists
- [ ] T046 [US2] **Not started — blocked on R7.** The same pair for `removeIssueLabel`: the failing test
      for one `{ issueId, actorId: actor.id, type: 'label_removed', fromValue: label.name }` row written
      only when the delete actually removed a row, then the `writeActivity(tx, …)` call inside
      `removeIssueLabel`'s existing transaction (FR-021, research C-6) — depends on T044

---

## Phase 5: Polish & Cross-Cutting Concerns

- [X] T047 [P] Walk quickstart.md's thirteen walkthroughs against a running `npm run dev` instance,
      skipping walkthrough 8 (activity rows, blocked on R7) and the activity half of walkthrough 5's
      independent test — everything else exercised live (SC-001…SC-006)

      **Done 2026-09-03.** Walkthroughs 1–7 exercised live in a real browser signed in as the seeded
      admin against the dev database: empty state, create ("Bug", count 0), case-insensitive clash named
      inline without submitting, rename ("Bug" → "Defect") reflected immediately on the issue rail and a
      freshly opened Create issue picker with no second edit, delete-with-count ("It will be removed from
      3 issues. This can't be undone.") and delete-with-no-count ("This can't be undone."), apply/remove
      on the rail with no page reload confirmed by reload-and-recheck, Create issue shipping an
      already-labelled issue, and reapplying a label leaving the count unchanged (no double row).
      Walkthroughs 9 and 10 (non-member read-only rail; nav hides for non-admin and the route still
      refuses) were verified by reading the already-green component and route tests instead of live
      browser, per this task's own allowance — no second user's password was available in the dev
      database to sign in live, and `issue-rail.test.tsx`'s "renders disabled with the rail's own reason
      for a non-member, calling no mutator" test and `page.test.ts`'s Forbidden-before-query test cover
      the same behaviour the walkthrough describes. Walkthrough 12 (keyboard-only) was partly blocked by
      an apparent limitation of the browser automation tool itself — Tab correctly moves focus and shows
      a visible focus ring, but the tool's synthetic Enter/Space key dispatch did not activate even a
      plain native `<button type="submit">`, ruling out an app-level cause — so keyboard *activation* was
      confirmed instead by code (every control is an unmodified `react-aria-components` primitive with no
      custom `onKeyDown` that could override its built-in keyboard handling) and by the existing
      `fireEvent.keyDown` Escape tests already green in `label-form-modal.test.tsx` and
      `delete-label-dialog.test.tsx`, which exercise the same jsdom event path.

      **Found and fixed during this walkthrough:** walkthrough 13 failed as originally implemented — the
      `/settings/labels` page's `Suspense` fallback was a plain `<p>Loading labels…</p>`, not a skeleton
      matching the eventual table, violating `OT-UX-005` ("Loading MUST use per-screen skeletons that
      match the layout they replace... data landing MUST NOT shift layout"). Added
      `src/features/labels/components/labels-skeleton.tsx` (`LabelsSkeleton`, mirroring the existing
      `RosterSkeleton`/`CreateIssueFormSkeleton` convention already used elsewhere in this codebase) with
      a failing-first test at `src/features/labels/components/labels-skeleton.test.tsx` asserting its
      table headers match `LabelsScreen`'s real table exactly and that it carries `aria-busy="true"`
      rather than a `role="status"` spinner, then wired it into `page.tsx`'s `Suspense` fallback in place
      of the placeholder text. Walkthrough 13 now passes by inspection of the fallback markup (component
      test verifies the shape is stable; a live slow-network observation was not attempted since the dev
      database answers `listLabelsWithUsage()` in well under a frame).
- [X] T048 Audit the diff against gate 6 — no comment, no commented-out code, no dead code — across
      every file this feature touched, with particular attention to `label-picker-field.tsx` holding no
      commit logic of its own (Principles V, VI)

      **Done 2026-09-03, nothing found.** Grepped every file in `src/features/labels/` and the edited
      `src/features/issues/` files for `//`, `/* */`, TODO/FIXME/XXX/HACK, and lint-suppression pragmas
      (`biome-ignore`, `eslint-disable`, `ts-ignore`, `ts-expect-error`) — zero matches anywhere,
      including test files. `npm run style-check` (Biome, `noUnusedImports`/`noUnusedVariables`) reports
      zero findings in this feature's files; the one warning it reports (`roster-table.tsx`,
      `noImgElement`) predates this feature (`a3773ef`, R3) and is untouched by this diff. Read every
      production file in `src/features/labels/server/` and `src/features/labels/components/` in full:
      each is tight and traces directly to its task — no dead branches, no unused exports.
      `label-picker-field.tsx` holds no commit logic — `onToggle` is the only side effect, called from
      `handleSelectionChange`, with the actual `addIssueLabel`/`removeIssueLabel` calls living in the
      rail and form that own it, exactly as T038/T043 required.
- [X] T049 Audit the diff against gate 7 — every changed line traces to a requirement, and the only
      files touched outside `src/features/labels/` are `src/db/schema.ts`, `src/db/test-database.ts`,
      `src/app/(app)/settings/labels/page.tsx`, and the three named R6 touch points
      (`issue-rail.tsx`, `create-issue-form.tsx`, `create-issue.ts`/`actions.ts`) — no `src/lib/` or
      `src/components/shared/` file is added, since this feature needs no palette module

      **Done 2026-09-03 — this task's own file list undercounted reality; corrected here, no unrelated
      changes found.** The actual outside-`src/features/labels/` diff (`git diff 3931bc6..HEAD --stat`)
      also touches, beyond the four files named above: `src/app/(app)/route-guards.test.ts` (registers
      `/settings/labels` as delivered, one line); `src/app/(app)/projects/[projectKey]/issues/new/page.tsx`
      and `src/app/(app)/projects/[projectKey]/issues/[issueNumber]/details/page.tsx` (+ its
      `page.test.ts`) — both fetch `listLabelOptionsForIssue` server-side and pass it down, the same
      shape those pages already used for `columns`/`assigneePool`; and inside `src/features/issues/`,
      `components/issue-detail.tsx` (threads `labelOptions`/`canManageLabels`/the two label actions from
      the page down into `IssueRail`), `components/issue-detail.test.tsx` and
      `components/assigned-non-member.test.tsx` (both drop a now-stale "no label control" assertion since
      a label control now legitimately exists), and `server/create-issue-defaults.test.ts` (one added
      test: omitting `labelIds` still creates zero `issue_label` rows, FR-016). Every one of these is a
      necessary consequence of wiring the picker into R6's *pages*, not only its rail/form components —
      the tasks.md list only named the rail/form/mutator files and missed the page-level plumbing that
      has to fetch the data those components render. Read every diffed line in all of them: none is
      unrelated to labels. No `src/lib/` or `src/components/shared/` file was added. The Precondition
      section above and `plan.md`'s Phase status table are updated to match this corrected file list.
- [X] T050 Confirm `package.json` gained no new dependency (gate 4) — every control used
      (`ListBox`, `AlertDialog`, `Dialog`) is already `react-aria-components`

      **Done 2026-09-03, confirmed.** `git diff 3931bc6..HEAD -- package.json package-lock.json` is
      empty. `ListBox`, `Dialog`, `Modal`, `DialogTrigger`, `Button`, `Form`, `TextField` are all imported
      from `react-aria-components/*`, already approved. There is no `AlertDialog` export in this
      project's installed `react-aria-components@1.20.0` — the codebase's existing convention (see
      `delete-issue-control.tsx`, predating this feature) is a plain `Dialog role="alertdialog"`, and
      `delete-label-dialog.tsx` mirrors that exactly, matching what T023 asked for.
- [X] T051 Run `npm run verify` — `style-check`, `type-check`, `test`, `build` — and confirm it passes
      with nothing failing or skipped. This passes with T045 and T046 left open: no test exists yet for
      `FR-021`'s activity rows, because there is no `writeActivity` to call — that is an open
      requirement, not a skipped test (gates 5, 8)

      **Done 2026-09-03.** `npm run verify` exits 0: `style-check` clean (one pre-existing, unrelated
      warning), `type-check` clean, `test` — 181 files, 1409 tests, all passed, none skipped — `build`
      succeeds, `/settings/labels` present in the route list. `src/features/activity` still does not
      exist and T045/T046 remain `[ ]`, untouched.

---

## Dependencies & Execution Order

### Phase dependencies

- **Precondition**: entries R2, R5, R6 implemented (confirmed true today). R7 is not, and blocks only
  T045/T046.
- **Setup (Phase 1)**: no dependencies beyond the precondition.
- **Foundational (Phase 2)**: depends on Setup. **Blocks both user stories** — neither table exists
  until it completes.
- **User stories (Phases 3–4)**: both depend on Foundational.
- **Polish (Phase 5)**: depends on both stories being complete (T045/T046 excepted).

### Story dependencies

- **US1 (P1)** — depends on Foundational only. This is the MVP and it stands alone.
- **US2 (P2)** — depends on Foundational **and on US1 having produced at least one label to pick**,
  per the spec's own *Why this priority* — the mutators (`addIssueLabel`, `removeIssueLabel`,
  `listLabelOptionsForIssue`) could be built against a row inserted by hand, but the picker has nothing
  real to offer until US1's `createLabel` exists.

### Within each story

- Tests are written and observed failing before the implementation that makes them green
- Schema before queries, queries before mutators, mutators before actions, actions before components,
  components before pages
- Each story ends with a refactor task run with its tests green (gate 2)

### Parallel opportunities

- T002 and T003 in Foundational — two test files, no shared state; then T004 alone, because both target
  one schema file
- Every `Tests for User Story N` block is fully parallel — one test file each (T027/T030 share a file
  with T028, so those three run sequentially against each other; every other pair is independent)
- T021 (label-row) is parallel with T022/T023 (modal, dialog) — three different files
- T038 (label-picker-field) is parallel with T036/T037 (server mutators) — different files, no shared
  state until T039 wires them together

---

## Parallel Example: User Story 1

```bash
# All Red steps for US1, one per file:
Task: "Query tests in src/features/labels/server/queries.test.ts"
Task: "createLabel tests in src/features/labels/server/create-label.test.ts"
Task: "updateLabel tests in src/features/labels/server/update-label.test.ts"
Task: "deleteLabel tests in src/features/labels/server/delete-label.test.ts"
Task: "No-activity tests in src/features/labels/server/no-activity.test.ts"
Task: "Screen tests in src/features/labels/components/labels-screen.test.tsx"
Task: "Modal tests in src/features/labels/components/label-form-modal.test.tsx"
Task: "Dialog tests in src/features/labels/components/delete-label-dialog.test.tsx"
Task: "Route test in src/app/(app)/settings/labels/page.test.ts"
```

---

## Implementation Strategy

### MVP first (User Story 1 only)

1. Phase 1: Setup
2. Phase 2: Foundational — **critical, blocks everything**
3. Phase 3: User Story 1
4. **Stop and validate**: run quickstart walkthroughs 1–4. Labels can be created, clash-checked, edited
   and deleted with a real count. Nothing applies one to an issue yet.

### Incremental delivery

1. Setup + Foundational → both tables exist
2. **+ US1** → the team's label vocabulary exists and is curated (MVP)
3. **+ US2** → labels apply to issues, at the rail and at creation
4. **R7 lands** → T045, T046 complete `FR-021`; this feature's only remaining gap closes with no
   further design work, because the row shape was pinned from day one

Each increment is a usable product. Stopping after US1 leaves an unused vocabulary, which is coherent
but not yet the payoff; stopping after US2 (today's real stopping point) leaves every requirement met
except one pair of activity rows nothing downstream of this feature currently reads.

---

## Notes

- **Tests are not optional here.** Principle VII is non-negotiable and gate 1 requires each test
  observed failing for the intended reason before its implementation. A test that passes on its first
  run is not a valid Red step and must be corrected.
- Every persistence test runs against the real PostgreSQL instance `TEST_DATABASE_URL` names, on a
  separate database.
- **A label carries no colour.** Nothing in this file builds, moves, or reads any palette module —
  see `research.md` §B for why an earlier draft of this plan assumed otherwise.
- **T045 and T046 are the one place this file records planned-but-not-implemented work.** They are not
  marked `[X]` under any circumstance until R7's `writeActivity` exists in code and admits
  `label_added` / `label_removed`. Marking them done without that would violate gate 1 (no test could
  have been observed failing for the intended reason) and Principle VII.
- Commit after each task or logical group; the commit order is the evidence a reviewer needs for gate 1.
