# Phase 1 — Quickstart validation

**Plan**: [`plan.md`](./plan.md) · **Spec**: [`spec.md`](./spec.md) · **Contracts**:
[`contracts/`](./contracts/)

Twelve walkthroughs. Each names the requirements it demonstrates, so a reviewer can run the list and
reach every acceptance scenario the spec states without reading the code. Five of the fourteen success
criteria are not observable from a browser at all — the frozen-vs-live pair, the pagination boundary
under a concurrent write, the length bounds at the database, and the cascade — and each of those names
the test that proves it instead.

---

## Prerequisites: entries R2, R5 and R6 are implemented

**Nothing here runs until all three are.** Today the repository holds R1 only. This feature consumes:

- from **R2** — the `(app)` shell, the toast conventions, the skeleton-below-the-guard rule;
- from **R5** — `project`, `project_member`, `isMember`, `isAdmin`, the project header with its
  colour dot and Board / Details tabs, `/projects/:projectKey/details`, and the seven mutators listed
  in [`contracts/mutators.md`](./contracts/mutators.md)'s reach-back table;
- from **R6** — `issue`, `updateIssue`'s existing delta computation (research D-6 depends on it being
  there already), and `/projects/:projectKey/issues/:issueNumber/details`.

```bash
git log --oneline -1 -- 'src/app/(app)'
```

```bash
git log --oneline -1 -- src/features/projects/server src/features/issues/server
```

An empty result from either means that entry has not landed and this checklist cannot be started.

### Then reconcile the two things this feature assumed about R5's and R6's shipped code

The spec was written against R5's and R6's *plans*, both of which have since landed as plans but not
as code. Read the shipped implementation and correct this feature's own plan where it diverges — the
point is to catch a divergence by reading, not by a failing migration.

| Assumed | Where to look | If it diverges |
| --- | --- | --- |
| `updateProject` does **not** already compute a diff against the stored row (research D-2) | `src/features/projects/server/update-project.ts` | If R5's shipped code added one anyway — matching `updateIssue`'s shape — this feature's edit there shrinks to "add one call per differing field," the same as `updateIssue`'s, and the Complexity Tracking entry for it no longer applies |
| `updateIssue` already computes its delta at one identifiable line (R6 research B-6) | `src/features/issues/server/update-issue.ts` | If the line moved or the delta's shape changed, `FR-056`'s edit follows whatever exists; the requirement is unchanged, only where the call lands |

R3 is **not** a prerequisite. This feature reads `user.deactivated_at`, which R1's table already
carries, for every mention list and ranked group; it needs none of R3's screens.

---

## Setup

```bash
npm ci
npm run db:migrate
```

Then, through R5's and R6's own screens: one project — key `WEB` — with two issues, `WEB-1` and
`WEB-2`. Three accounts: an admin, a member of `WEB`, and a third who is a member of neither.

```bash
npm run dev
```

---

## 1 · A comment is visible to everyone before it's a member's · `FR-001`…`FR-003`, `SC-001`, `SC-002`

As the member, open `WEB-1`, type a comment and post it.

Expect: it renders at the top of the feed immediately, before the row exists anywhere else — author,
avatar, relative time — carrying `id="comment-<id>"` in the markup (`FR-029`). Then, as the third
account (not a member of `WEB`), open the same issue.

Expect: the identical comment, on their very next view — no comment is ever visible to its author
alone.

Post a second comment on `WEB`'s own `/projects/WEB/details` feed and confirm it appears there and
nowhere else — an issue's feed and its project's feed never share a row (US2 scenario 10 restated for
comments).

## 2 · The composer refuses without going dead · `FR-040`, `FR-041`, `SC-012`

Type three spaces into the composer and try to post.

Expect: an inline error, no `createComment` call, the control still usable. Paste 10 001 characters
and try again — an inline error naming the 10 000-character bound, nothing truncated, no call issued.

## 3 · Every write already there logs itself · `FR-050`…`FR-058`, `SC-003`

As the admin, create a project with two starting members through Create project.

Expect: its feed opens with one `created` row and two `member_added` rows, one per member, all
timestamped together (US2 scenario 1). Rename it, add a third member, archive it, then reopen it.

Expect: four more rows, each naming the actor and the change, in order. Then, on `WEB-1`, edit the
title and drag it to a different column.

Expect: two separate `field_changed` rows on `WEB-1`'s own feed — one naming the title's old and new
value, one naming the column's old and new name — and neither row on `WEB`'s project feed (`FR-057`).

Now save the same title again, unchanged, from a stale tab.

Expect: nothing is written — no new row on the feed, `updated_at` on the issue itself unmoved. This is
`SC-003`'s "zero rows produced for a call that changes nothing," and it is the one place this feature
had to add logic `updateProject` (and `updateIssue`, already present) did not need before it (research
D-2).

## 4 · A frozen string stays frozen; a mention stays live — and both at once · `FR-007`, `FR-022`, `SC-005`, `SC-006`

Change `WEB`'s colour from grey to blue through project details.

Expect: the activity row reads the palette names — "grey" and "blue" — never a hex value (`FR-009`).
Note the exact row. Then post a comment mentioning the admin by name, and separately rename the admin
through their own profile (once R4 exists) or directly in the database for this check.

Expect: the colour-change row, written before the rename, still reads "grey" and "blue" — nothing
about it changed. The comment's mention now shows the admin's *new* name, on the same read. Both are
true on the same page load: one field frozen at write time, the other resolved live — the opposite
rule stated once for each (`FR-007`, `FR-022`).

## 5 · Authorship survives membership; nobody else touches a word · `FR-016`, `FR-017`, `SC-007`

As the member, edit your own comment's text and save.

Expect: the new text renders immediately, no new feed row appears — the comment row is its own entry
(`FR-047`). Press Escape mid-edit on a second attempt: it reverts, nothing is written.

As the admin, remove the member from `WEB`, then have that former member reopen the comment they wrote
while a member.

Expect: they can still edit and delete it — authorship, not membership, governs both (`FR-017`). As
the third account (never a member, not the author), open the same comment.

Expect: no edit control renders at all. As the admin, who authored nothing here, confirm a delete
control renders on it and works.

## 6 · A mention ranks the people who can act on it first · `FR-024`, `FR-025`

In `WEB-1`'s composer, type `@` alone.

Expect: a ranked list opens immediately — no letters required — with `WEB`'s member and every admin
above the unrelated third account, and no deactivated account anywhere in it. Pick the member, post,
and confirm the stored comment renders their current display name. Deactivate that member (through R3
once it exists) and reload the comment.

Expect: their name keeps rendering on the mention exactly as it does on a frozen activity row's actor
name (`FR-023`), even though the mention itself is resolved live, not frozen — the deactivation flag
never gates rendering, only future selection.

## 7 · A long feed narrows, folds and never loads all at once · `FR-031`…`FR-033`, `SC-008`, `SC-010`

Seed `WEB-1`'s feed with 60+ activity rows including a run of five field changes by one actor inside
one minute (a script, not the UI — this is a data-setup step, not a walkthrough of a control).

Expect on open: 50 rows load; the run of five collapses into one expandable line reading the actor and
"5 changes." Scroll to the foot.

Expect: the remaining rows append without a page reload, and the newly appended rows are counted
before any further collapsing — the 50-row page size never varies with how bursty the history happens
to be (`FR-032`). Toggle **Comments only**.

Expect: every non-comment row disappears from what is loaded, without a re-fetch (`FR-033`). Open
`WEB`'s own project feed next.

Expect: it opens already filtered to **Comments only** — the choice was per-user, not per-feed
(`SC-009`).

## 8 · A comment posts before the server answers, and rolls back when it can't · `FR-037`, US1 scenario 6, US1 scenario 7

With the member's issue page open, remove them from `WEB` in a second browser as the admin. Back in
the first, without reloading, post a comment.

Expect: it appears at the head of the feed immediately, then rolls back with a toast naming what
failed and why, and the composer disables on the next render (`FR-020`).

Then, still as the removed member, call the comment-post path directly, bypassing the disabled
control.

Expect: the server refuses it independently of the control's state (US1 scenario 7).

## 9 · Two deletes race; one wins · `FR-048`, spec → *Edge Cases*

Open the same comment's delete control in two browser tabs as the admin and a second admin (or the
admin and the author). Confirm delete in both, as close together as you can manage.

Expect: one succeeds; the other's server call resolves to "this doesn't exist" rather than a second
success, and the comment disappears exactly once from the feed.

## 10 · The project header counts only its own comments · `FR-059`

Post two comments on `WEB`'s own project feed and one comment on `WEB-1`'s issue feed.

Expect: the project header's comment count reads **2**, not 3 — an issue's comments never count toward
its project's own total.

## 11 · A project delete takes its comments and its history with it · `FR-058`, `SC-013`

As the admin, archive `WEB` and delete it, after noting an issue and a project comment both exist
inside it.

Expect: the browser lands away from the deleted project, and neither comment nor any activity row that
referenced it is reachable afterward. This is verified against the database directly in the test suite
([`research.md`](./research.md) A-3); the walkthrough is the visible half of the same guarantee.

## 12 · Keyboard alone, and every disabled reason announced · `OT-UX-018`, `FR-061`

Complete walkthrough 1 without touching the mouse: Tab to the composer, type, ⌘-enter to post. Then
Tab through a comment row's edit and delete controls, and through the feed filter toggle and the
mention picker — opening it with `@`, moving through the list with arrow keys, selecting with Enter.

Expect: a visible focus indicator at every stop, and inside the mention popover a normal tab order with
Escape closing it and returning focus to the composer. Then focus a disabled composer as the third
account.

Expect: the reason is announced as *that control's* own explanation, not as separate nearby text
(`FR-061`, matching R6's own `SC-022` mechanism).

---

## What a browser cannot show you

| Criterion | Proved by |
| --- | --- |
| `SC-004` — no `from_value`/`to_value` ever exceeds 200 characters | the truncation test, writing a description-length change and asserting the frozen string's length (research A-8's index does not bound this; the `CHECK` does) |
| `SC-005` — a frozen row's wording never changes after a rename | the persistence test: write a row, rename the entity, re-read the row byte-for-byte |
| `SC-006` — a mention always matches the current display name | the inverse of `SC-005`, on the same rename, same test file |
| `SC-011` — a control a user may not use always carries a reachable reason | the accessibility assertions in the component tests, not a manual audit alone |
| `SC-012` — an over-length body is refused even with the client's check bypassed | the mutator tests, calling `createComment` and `updateComment` directly, plus the `CHECK` tests |
| `SC-013` — nothing survives a deleted project or issue | the cascade test, asserting from a second connection outside the deleting transaction |

---

## The gate

```bash
npm run verify
```

`style-check`, then `type-check`, then `test`, then `build`. CI runs exactly this and nothing else.

`npm test` runs with `--passWithNoTests`, so a green run is not by itself evidence of gate 1 — the
commit order, one Red step per acceptance scenario, is.
