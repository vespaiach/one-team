# Quickstart — validating Board columns (R9)

**Feature**: [`spec.md`](./spec.md) · **Plan**: [`plan.md`](./plan.md) ·
**Contracts**: [`contracts/mutators.md`](./contracts/mutators.md), [`contracts/screens.md`](./contracts/screens.md)

How to prove this feature works, and — as importantly — which of its guarantees a browser **cannot**
show you, so nobody signs it off from the screen alone.

## Prerequisites

- PostgreSQL 18 reachable, with **two** databases: the development one `DATABASE_URL` names, and a
  separate one `TEST_DATABASE_URL` names. Never point tests at development, staging or production
  data (`AGENTS.md` → Testing).
- `npm install` — **no new package is installed by this feature**. If `npm install` wants to add one,
  something has gone wrong: check it against `AGENTS.md`'s approved table before proceeding.
- `npm run db:migrate` to apply `drizzle/0007_*.sql`, the `activity.type` `CHECK` widening. Vitest's
  `server` project migrates the test database itself through `src/db/test-setup.ts`.
- An admin account, a member account and a signed-in non-member account. `npm run admin:grant` grants
  admin.
- A project holding its five seeded columns — Backlog `open`, Todo `open`, In Progress `open`,
  Done `done`, Canceled `canceled` — and at least one issue.

## The gate

```
npm run verify          # style-check → type-check → test → build. CI runs exactly this.
```

Nothing is done until this is green with no failing and no skipped test (gates 5 and 8). Useful
during the loop:

```
npm test
npx vitest run src/features/projects/server/delete-column.test.ts
npx vitest run -t "refuses the project's last done-kind column"
npm run style-check
```

---

## Walkthroughs

Each names the requirement it proves. Sign in as the admin unless stated.

### 1. Add — FR-019, US1-1, US1-2

Open `/projects/<KEY>/details`, find **Columns**. The add control at the foot of the list offers
**a name field and nothing else** — no kind control, no position control. Add `Review`.
✅ It appears **last**, kind `open`, count 0. The five seeded columns are untouched.

### 2. Rename in place — FR-024, US1-3

Activate `Todo`'s name. ✅ It becomes a field where the name already stood.
Press Escape ✅ it reverts unchanged, and focus returns to the control.
Reopen it, type `Up next`, press ⌘-enter (or Ctrl-enter) ✅ it saves, once.
Reopen it and blur without typing ✅ **no call is made at all**.

### 3. The collision — FR-021, FR-025, FR-026, SC-006

Rename `Review` to `backlog` (lower case). ✅ Refused with an **inline** error naming the existing
**Backlog** column. No suffix. Nothing written.
Add a column named `Backlog`. ✅ Same rule, same inline error — the constraint belongs to the pair,
not to the mutator (US1-7).
Rename `Todo` to `todo`. ✅ **Accepted** — a column never collides with itself (US1-6).
Add `  Backlog  ` with surrounding spaces. ✅ Refused: trimmed before comparison (seventh Edge Case).
Submit an empty name, and a 201-character name. ✅ Each refused inline; a 200-character name is
accepted (US1-8, US1-9).

### 4. Reorder by drag and by keyboard — FR-028…FR-033, US2, SC-013

Drag `Canceled` from last to first. ✅ On reload it is first and the other four keep their relative
order. ✅ **No issue changed column** (§4, check the board or the rail).
Drop a column onto the position it already occupies. ✅ Nothing is written and **no activity row
appears**.
Now with the keyboard alone: Tab to a row, Enter to lift, arrows to move, Enter to drop. ✅ The same
reorder, with a visible focus indicator and an accessible name at every step. Escape mid-drag ✅
nothing written.

### 5. The four refusals — FR-034…FR-040, US3, SC-004

With one issue in `Todo`:

| Try | Expect |
| --- | --- |
| Delete `Todo` | disabled, inline reason: **still holds issues** |
| Move that issue out, Delete `Todo` | enabled → confirmation **naming Todo** → removed |
| Delete `Done` | disabled: the project's **last `done`-kind** column, and the kind can't be reassigned |
| Delete `Canceled` | disabled: a member's **only route to remove an issue** |
| Delete down to one column, then Delete it | disabled: a project always has **at least one column** |

✅ Each reason is its own wording — never one generic "can't delete this".
Dismiss a confirmation with Cancel, with the backdrop, and with Escape. ✅ Each time: nothing written,
no activity row, and **focus back on the Delete control** (SC-014, ninth Edge Case).

### 6. Precedence — FR-038, first two Edge Cases

Take a column that both holds issues **and** is the project's last. ✅ The reason shown is
**holds issues** — the higher of the two, and the one the admin can act on. Reload, repeat: ✅ the
same reason every time, because it is chosen by precedence and not by which check ran first.

### 7. The kind is not editable, ever — FR-002, FR-017, SC-007, SC-008

✅ The kind renders as **text**, for the admin as well as everyone else — not a disabled control,
because nobody of any role may change it.
✅ Every column you added carries `open`. There is no path in the product that produces `done` or
`canceled` after project creation.

### 8. Read-only for everyone else — FR-016, US4, SC-009

Open the same page as the member, then as the signed-in non-member. ✅ Both see **all** the columns
with kinds and counts, exactly as the admin does. ✅ Neither is offered an add control, an editable
name, a drag affordance or a delete control.
Open `/projects/NOSUCHKEY/details`. ✅ "This doesn't exist" — never a hidden-access state.

### 9. The archived project — FR-007, third Clarification, eighth Edge Case

Archive the project, then add, rename, reorder and delete a column. ✅ All four work. Archiving is
reversible and changes nothing about a project's board.

### 10. The activity feed — FR-042…FR-048, US5

With the feed at the foot of the same page: add a column, rename it, drag it one position, delete it.
✅ Four rows, in that order, each naming the actor and the column:

- *Ana added column Review*
- *Ana renamed column Review to Triage* — carrying **both** names
- *Ana moved column Triage after Todo* — or *…to first*
- *Ana deleted column Triage*

✅ Being four changes by one actor inside five minutes, they fold into one expandable line under the
collapsing rule R7 already applies (US5-6).
Now rename the project's other columns. ✅ Every row already written still reads exactly as it did —
the names are frozen, not re-resolved (SC-012, US5-8).
Open any issue in the project. ✅ **No column row on its feed** — a column edit is project history
(US5-7).
Attempt a colliding rename and a refused delete. ✅ **No activity row for either** (US5-5).

---

## What a browser cannot show you

These are the guarantees this feature exists for, and every one of them is proved by a test against a
**real PostgreSQL instance on the separate test database**, because they are enforced by constraints
and row locks that a mock cannot verify (`AGENTS.md` → Testing).

| Guarantee | Where it is proved |
| --- | --- |
| **The widened `CHECK` admits exactly four new values** — and refuses `column_recolored` | `src/features/activity/server/write-activity.test.ts` — write each of the four through `writeActivity`, then assert a fifth value is refused with `23514` |
| **Two admins deleting the last two `done`-kind columns at once** — one commits, one is refused (SC-003, fourth Edge Case) | `delete-column-race.test.ts`, two connections, two interleaved transactions |
| **An issue moved into the column between the emptiness check and the delete** — refused, not deleted (SC-005, third Edge Case) | same file; the `FOR UPDATE` / `FOR KEY SHARE` conflict is the mechanism |
| **Two admins renaming two columns to the same name at once** — one is refused by the constraint, not by a stale read (fifth Edge Case) | `update-column-race.test.ts` |
| **Uniqueness is the database's, not the mutator's** (FR-051) | the race test above passes only if no pre-flight read is doing the work |
| **A no-op drop writes nothing, `updated_at` included** (FR-030) | `move-column.test.ts` — capture `updated_at`, drop in place, assert byte-identical |
| **A refused write leaves no activity row** (FR-048, SC-011) | count `activity` rows before and after each refusal |
| **A reorder writes exactly one row, for the moved column** (FR-047) | `activity` count and contents after one drag, asserted against the database |
| **No column edit ever touches an issue** (SC-002) | a full census of every issue's `column_id` before and after each of the four mutators, asserted identical |
| **A bypassed control is refused anyway** (FR-040, US3-7, US4-3) | call each mutator directly as a member and as a non-member; call `deleteColumn` directly on a refused column |
| **The precedence is precedence, not evaluation order** (FR-038, SC-004) | a pure unit test over the four booleans, all sixteen combinations, no database needed |

Two things worth saying plainly to a reviewer:

- **`npm test` runs with `--passWithNoTests`.** A green run is not by itself evidence of Principle VII.
  The evidence is the commit order — a failing test, observed failing for the intended reason, before
  each unit of production code (gate 1). That includes the migration: the first Red step is an
  `activity` insert of type `column_added` failing with `23514` against the **un**widened `CHECK`.
- **`generateKeyBetween` is `fractional-indexing`, already on the approved table**, and
  `useDragAndDrop` is `react-aria-components`, likewise. **No drag-and-drop library is added** — if
  one appears in `package.json`, gate 4 has been broken.
