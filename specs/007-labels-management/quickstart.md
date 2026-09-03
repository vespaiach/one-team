# Phase 1 — Quickstart validation

**Feature**: Labels · **Entry**: R8 · **Spec**: [`spec.md`](./spec.md) · **Data model**:
[`data-model.md`](./data-model.md) · **Contracts**: [`contracts/`](./contracts/)

## Prerequisites: entries R2, R5, R6 are implemented; R7's code is not

R2, R5 and R6 are implemented. This feature's own guard-only page (`/settings/labels`) needs R2's shell
and `forbidden()`; its picker needs R6's issue rail and Create issue form to exist to be edited; its
`isMember` check needs R5's `project` and `project_member`. **`addIssueLabel` and `removeIssueLabel`'s
activity write additionally needs R7's `activity` table and `writeActivity` function to actually exist
in code** ([`research.md`](./research.md) C-6) — every other walkthrough below runs without it, but the
two activity-writing steps (7, 8) cannot be exercised for real until R7 lands.

### Reconcile before implementing

1. **`recordActivity`'s actual shape**, against R7's landed plan — this feature's `addIssueLabel` and
   `removeIssueLabel` import path and call shape ([`research.md`](./research.md) C-6).
2. **`createIssue`'s accepted shape**, against R6's landed plan — confirming the mutator still accepts
   a partial-field object this feature can add `labelIds` to without restructuring it.

## Setup

```bash
npm run db:generate   # after schema.ts gains label and issue_label
npm run db:migrate
npm run dev
```

Sign in as the seeded admin (§6). A second, non-admin account and at least one project with an issue
(both from R5/R6) are needed for scenarios 6 onward.

---

## 1 · An admin creates a label from nothing · `FR-006`…`FR-008`, `SC-001`

Visit `/settings/labels` with none created yet. Confirm the empty line "No labels yet". Press **New
label**, type "Bug", confirm. The modal closes; the table shows one row — "Bug", usage count 0.

## 2 · A clash is named, not silently accepted · `FR-007`

Create a second label typed as "bug" (lowercase). Blur the name field before submitting: an inline
error names "Bug" as the existing holder. The form is not submittable until the name changes.

## 3 · An edit lands everywhere at once · `FR-009`, `FR-010`, `SC-002`

With "Bug" applied to an issue (scenario 5 below), open **Edit**, rename it to "Defect". Save. The
labels table shows the new name; the issue's rail and the Create issue picker, opened fresh, show
"Defect" too — no second edit anywhere.

## 4 · Delete states its count before it destroys anything · `FR-011`, `FR-012`, `SC-003`, `SC-004`

Apply "Defect" to three issues total. Open **Delete** on it: the dialog reads "It will be removed from
3 issues. This can't be undone." Confirm. The row disappears from the table; each of the three issues,
reloaded, no longer carries it. Create a second label, apply it to nothing, and delete it: the same
dialog appears with no count clause.

## 5 · A member applies and removes a label on an issue · `FR-015`, `FR-021`, `SC-005`

Sign in as a project member (not the admin). Open one of that project's issues, open the rail's label
picker, select "Bug". It appears on the issue immediately, with no page reload. Toggle it off; it is
gone immediately.

## 6 · Create issue ships an issue already labelled · `FR-016`

From the same project, open Create issue, pick two labels before submitting. The new issue's detail
page, on arrival, already shows both.

## 7 · Applying twice is a no-op · `FR-022`

With a label already applied, select it again from the picker (if the UI exposes it as still toggle-
able mid-flight) or call `addIssueLabel` a second time directly. The issue still carries it exactly
once; no second `issue_label` row, no second activity entry.

## 8 · One activity row per label, on the issue's own feed · `FR-021`

*(Needs R7's activity feed rendered to observe directly; until then, assert the `activity` table row
in a server test.)* Applying a label writes one `label_added` row naming that label; removing it writes
one `label_removed` row. Applying two labels in two separate calls writes two rows, never one row
holding both names.

## 9 · A non-member reads and cannot write · `FR-019`, `SC-006`

Sign in as a user with no membership on the issue's project. The rail's label picker (and the rest of
the rail) renders disabled with an inline reason naming the project. No label can be toggled.

## 10 · Navigation to curation hides for non-admins, and the route still refuses · `FR-002`, `FR-018`, `SC-004`

Sign in as a non-admin member. Confirm: no **Labels** entry in the sidebar; no **Manage labels** link at
the foot of either picker. Visit `/settings/labels` directly — Forbidden.

## 11 · Curating the set writes no activity · `FR-013`

Create, rename and delete a label (using one carrying no issues, so nothing else fires).
Confirm no row lands in any project's or issue's activity feed for any of the four actions, and that
deleting a label carried by issues writes nothing on those issues either.

## 12 · Keyboard alone · `OT-UX-018`, `AGENTS.md` → React Aria

Tab to **New label**, open it with `Enter`, tab to the name field, submit with `Enter`. Tab to a
picker's options; `Space` toggles a label without a mouse. Every control carries a visible focus
indicator and an accessible name naming what it is.

## 13 · The labels page loads as itself · `SC-001`

A slow network shows the labels page's own skeleton — rows shaped like the eventual table — never a
full-screen spinner and never a layout shift once data lands (`OT-UX-005`).

---

## What a browser cannot show you

- **The functional unique index enforces the race**, not only the pre-check (`research.md` C-3) — a
  server test creates two labels named identically (differing only by case) through two concurrent
  connections and asserts exactly one succeeds.
- **`addIssueLabel`'s idempotency under real concurrency** (`research.md` E-3) — two connections racing
  `addIssueLabel` for the same issue and label; the table holds exactly one row afterward and neither
  call raises.
- **The 200-character bound** (`research.md` A-7) — a server test attempts the violating insert
  directly against `TEST_DATABASE_URL` and asserts the database refuses it, independent of whatever the
  modal's own client-side check would have caught.
- **`ON DELETE CASCADE` reaches `issue_label` from both directions** (`data-model.md` §4) — deleting an
  issue removes its `issue_label` rows without `deleteIssue`'s own body changing; deleting a label
  removes its `issue_label` rows without `deleteLabel` issuing a second statement.
- **A no-op write leaves no trace** (`research.md` C5) — reapplying an already-present label leaves
  `label.updated_at` (there is none to touch on `issue_label`) and the `activity` table exactly as they
  were; asserted by row count, not by watching a screen.

## The gate

`npm run verify` — `style-check`, `type-check`, `test`, `build` — is the bar every task in
[`tasks.md`](./tasks.md) is written against. A green run on an empty test file is not evidence of
anything (`npm test` passes `--passWithNoTests`); the evidence is the Red step each task's commit order
carries, per gate 1.
