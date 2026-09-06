# Quickstart — validating the board

**Feature**: `specs/009-board-grouping-drag-ordering`

How to prove this feature works once it is implemented, and — as importantly — which requirements a
browser cannot prove, and where they are proven instead.

## Prerequisites

```bash
cd /path/to/one-team
cp .env.example .env            # DATABASE_URL and TEST_DATABASE_URL, two separate databases
npm install
npm run db:migrate              # this feature adds no migration; existing ones must be applied
npm run dev
```

Persistence tests need a real PostgreSQL instance on a **separate** database, never development,
staging or production data (`AGENTS.md` → Testing). `docker-compose.yml` at the repo root brings one
up.

Seed a project with its five columns (Backlog · Todo · In Progress · Done · Canceled), a handful of
issues spread across them with a mix of priorities, assignees, labels, due dates and comments, and at
least: one issue with **none** of the optional fields set, one assigned to somebody who is not a
member, and one assigned to a deactivated user.

## The gate

```bash
npm run verify          # style-check → type-check → test → build. CI runs exactly this.
```

Nothing below is a substitute for it. Do not report a check as passing without having run it.

---

## Walkthroughs

### 1 — The board renders where "This doesn't exist" used to be (US1, FR-001)

Sign in, open `/projects/<KEY>`. The five columns render in board order, each with its name and a
live count, each listing its issues in `(sort_order, id)` order. Click a card: it opens that issue's
own page at its own URL, not a panel over the board.

Then check the negatives, which are half the requirement: a card with no optional fields shows its
key and title **alone** — no placeholder, no empty slot, no "unassigned" chip (FR-010). No label,
lane or card carries a colour that identifies it (FR-011, SC-016). An empty column shows one quiet
line and still renders its composer (FR-008).

Open `/projects/NOSUCH` — "This doesn't exist", not a permission refusal (FR-003). Sign out and
request the board — sign-in, never Forbidden (FR-003).

### 2 — One drop, one row (US2, SC-002)

Before dragging, take a census:

```sql
SELECT id, sort_order, column_id, assignee_id, priority FROM issue
 WHERE project_id = '<id>' ORDER BY sort_order, id;
```

Drag a card from Todo to In Progress. Re-run it. **Exactly one row differs**, in exactly two columns
(`sort_order`, `column_id`), plus `updated_at`. Nothing else moved.

Now reorder a card inside one lane and census again: `sort_order` alone changed; `column_id` did not
(FR-030, SC-004).

Drop a card back where it already sits: **nothing changes at all**, and `activity` gains no row
(FR-032).

### 3 — Between the neighbours, and never a repair (SC-003, SC-005)

Drop a card between two others and verify against the board's own ordering rather than the optimistic
render:

```sql
SELECT id, sort_order FROM issue WHERE project_id = '<id>' ORDER BY sort_order, id;
```

The moved card sorts strictly between its two new neighbours. Head and foot drops sort before and
after everything in the lane.

Then the one that matters most: perform a hundred drops, deliberately creating ties. **Every index
that was not itself the subject of a drop still holds the value it started with**, and tied cards
still render in id order. If any untouched index changed, `OT-DATA-017` has been violated.

### 4 — Regrouping (US3, SC-006)

Switch to Assignee. **Unassigned** is first, then the pool ordered by `lower(last_name)`, then
`lower(first_name)`, then the still-assigned people outside it under that same ordering, as their own
block after the pool and never interleaved with it — each person exactly once. Drop a card into
another person's lane: their assignee changed, their column and priority did not.

Drop a card into **Unassigned**: the assignee is cleared, nothing else but the index changed
(FR-037).

Switch to Priority: exactly five lanes, Urgent → No priority. Drop into Urgent: priority changed,
column and assignee did not.

In every grouping, count the cards: **no card is missing from every lane and no card is in two
lanes**, including cards with no assignee and no priority (SC-006).

Then confirm the honest consequence: reorder under Column, regroup by Assignee, and see that the
relative position there changed too. Nothing hides or compensates for it (FR-025).

Leave the board and come back: it is grouped by **Column** again, and the URL never carried the
choice (FR-020).

### 5 — The lane that accepts no drop (US3 sc.12, the fourth Clarification)

Under Assignee grouping, find the deactivated user's lane. Their cards render in it. It accepts no
drop. Its composer renders — **disabled, with its reason inline** — rather than being hidden or
silently swallowing the gesture (FR-052).

### 6 — The composer (US4, SC-013)

Under Column grouping, type a title into In Progress's composer and press enter. One issue is
created, in that column, as the **last** card in the lane, directly above the composer that made it —
and no existing issue's `sort_order` was written (census again).

Press shift-enter instead: the Create issue page opens with In Progress preselected and the typed
title carried across. Same with the chevron. Under Assignee or Priority grouping the chevron
preselects the project's first column plus that lane's assignee or priority (FR-048).

Submit an empty title: nothing is created and the refusal is **inline on the field**, not a toast
(FR-051).

Hand-edit the URL to `/projects/<KEY>/issues/new?columnId=<a column of another project>`: the form
renders its own default rather than the foreign column (research E-3).

### 7 — Freshness and conflict (US5, SC-007, SC-008)

Open the board in two sessions. Move a card in the second. The first shows it within thirty seconds
without navigation, and **immediately** on regaining window focus (FR-054, SC-008).

Begin a drag in the first and let a re-query land mid-gesture: the drag is not cancelled, the board
updates underneath it, and the drop resolves against the refreshed neighbours (FR-055, SC-009).

Issue two conflicting moves of one card. The later write is what the database holds, and **neither
client was shown a rejection** (FR-057, SC-007).

Delete an issue from a second session: at the next re-query the card is gone with no error, and a
drop already in flight for it is refused as a missing row, not a permission one (US5 sc.8).

### 8 — Refusal and rollback (SC-010)

Refuse a drop each of the four ways and confirm the card returns to the **exact** position it came
from, each with its own message:

| how to provoke it | expected |
| --- | --- |
| remove your membership in a second session, then drop | `forbidden`, naming the project |
| delete the target column in a second session, then drop | `not_found`; the board refreshes |
| call the action directly with another project's column id | `invalid_target` |
| give two cards an identical `sort_order`, then drop a third between them | `no_index_available`; **nothing is renumbered** |
| stop the server, then drop | the connection message; nothing queued; the card returns |

### 9 — The read boundary, from the other side (US6, SC-011, SC-012)

Sign in as a signed-in **non-member**. The lanes, cards, counts and empty-lane lines are identical to
a member's — compare the two rendered structures (SC-012). No card can be dragged and no call is
made. Every composer and every entry point to Create issue is disabled with a reason naming the
project, and none is hidden.

Then the enforcement, which is the actual requirement: **call `moveIssue` directly**, without going
through a control, as that non-member. It is refused whatever the board rendered (FR-065, SC-011).
Confirm the Create issue route still answers Forbidden to that user by deep link (FR-053).

Sign in as an admin holding **no** membership row: they may drag, compose and move, and have a lane
of their own under Assignee grouping (FR-068).

### 10 — Keyboard alone (SC-015)

With no pointer: tab to a card's drag handle, start the drag, move it to another lane, drop it. The
same `moveIssue` is made. Every drop target announces its lane's name and every control shows a
visible focus indicator throughout (FR-043).

Do the same for the composer and the grouping control.

### 11 — Activity (SC-014)

Against the database, not through the feed that reads it:

```sql
SELECT type, field, from_value, to_value FROM activity
 WHERE issue_id = '<id>' ORDER BY created_at DESC;
```

A cross-lane drop produced **exactly one** `field_changed` row, `field` holding the literal `column`,
`priority` or `assignee`. A Column or Assignee drop wrote display **names** rather than ids; a
Priority drop wrote the raw priority literal — `urgent`, `high`, `medium`, `low`, `none` — which is
what R6's `updateIssue` already writes for the same field. A drop into **No priority** therefore
records `none`, not a null. A drop into **Unassigned** wrote a null `to_value`, and the feed renders
it as `"None"`.

A same-lane reorder produced **none** (FR-061). No row landed on the project's feed:

```sql
SELECT count(*) FROM activity WHERE project_id = '<project id>';   -- unchanged by every drop
```

### 12 — Archived, and the columns that are not terminal

Archive the project. The board renders exactly as before, drops are accepted and the composer works
(FR-039, US1 sc.12). Drag a card into the Done column and straight back out: both accepted, no
confirmation, no guardrail — no column is a terminal state (FR-040).

---

## What a browser cannot show, and where it is proven instead

| Requirement | Proven by |
| --- | --- |
| FR-028's "exactly one row" | the SQL census before and after each drop (walkthrough 2), and a `server` test asserting it |
| FR-024 / SC-005's "never repaired" | the hundred-drop test, against the database |
| FR-031's `no_index_available` | a `server` test that seeds two equal indexes; the Red step observes the raw `generateKeyBetween` throw escaping before the mapping exists (research F-2) |
| FR-057 / SC-007's last-write-wins | two concurrent `moveIssue` calls in one `server` test against real PostgreSQL — a mock cannot show that neither was rejected |
| FR-055, FR-056, FR-025, SC-003, SC-006, SC-009 | the pure functions in `src/features/board/lane-model.ts`, with exact expected outputs. jsdom cannot perform a pointer drag, so a DOM test of these would be testing the harness (research D-2, F-4) |
| FR-065 / SC-011's "issued without going through a control" | a `server` test calling the mutator directly as a non-member |
| SC-012's identical structures | a component test comparing the two renders, following `issue-detail-parity.test.tsx` |
| FR-043 / SC-015's keyboard drag | explicit keyboard events. `@react-aria/test-utils` is not installed and is not added (IV) |

## Commands

| Task | Command |
| --- | --- |
| the mutator's tests | `npx vitest run src/features/issues/server/move-issue.test.ts` |
| the ordering model's tests | `npx vitest run src/features/board/lane-model.test.ts` |
| one test by name | `npx vitest run -t "refuses a non-member"` |
| the full gate | `npm run verify` |

**`npm test` runs with `--passWithNoTests`**, so a green run is not by itself evidence of Principle
VII. The commit order is.
