# Phase 1 — Quickstart: validating Notifications and email

**Feature**: R11 · **Spec**: [`spec.md`](./spec.md) · **Plan**: [`plan.md`](./plan.md)

Thirteen walkthroughs that prove the feature end to end, plus a section on what a browser **cannot**
show you. Every command is run from the repository root.

---

## Prerequisites

| Need | Check |
| --- | --- |
| R1…R10 on this branch | `src/features/issues/server/move-issue.ts` exists (R10) and `src/db/schema.ts` ends at `activity` before this feature (R7) |
| Dependencies installed | `npm ci` — this worktree does not share the main checkout's `node_modules` |
| A development database | `DATABASE_URL` in `.env`; `npm run db:migrate` |
| A **separate** test database | `TEST_DATABASE_URL`; never a development, staging or production database (`AGENTS.md`, *Testing*) |
| `APP_URL` | asserted by `bootstrap`; the mail link and the origin check both read it |
| Optional — a mail host | `SMTP_URL` and `MAIL_FROM`. With neither set, every send returns `not_sent` and the in-app half still works (FR-070) — which is itself walkthrough 11 |

```bash
npm run db:generate        # after src/db/schema.ts gains the notification table
npm run db:migrate         # applies drizzle/0008_*.sql
npm run verify             # style-check → type-check → test → build. The gate.
npm run seed               # a populated development database to click through
```

**Watch a single file while working**: `npx vitest run src/features/notifications/server/write-notifications.test.ts`
**One scenario by name**: `npx vitest run -t "writes no row for the actor"`

---

## Walkthrough 1 — the migration is what it claims to be

Before running it, read `drizzle/0008_*.sql` and confirm three things by eye (FR-009):

- both partial indexes carry their `WHERE` clause —
  `notification_user_id_unread_idx … WHERE "read_at" is null` and
  `notification_user_id_comment_id_idx … WHERE "comment_id" is not null`;
- the three foreign keys to `issue`, `project` and `comment` render `ON DELETE cascade`, and the two
  to `user` render **no** `ON DELETE` clause;
- `send_attempts` renders `integer DEFAULT 0 NOT NULL`.

Then:

```bash
npm run db:migrate
psql "$DATABASE_URL" -c '\d notification'
```

**Expected**: twelve columns, five `CHECK` constraints, three indexes, five foreign keys. No `pgEnum`
type anywhere — `src/db/schema.test.ts` already asserts this and will fail if `type` was declared as
one.

---

## Walkthrough 2 — the screen renders what the person holds, and nothing else

1. Sign in as a user holding a spread of rows: a `mention` on an issue, an `assignment`, a `comment` on
   a project, some read and some not.
2. Open `/notifications`.

**Expected** (FR-011…FR-018): rows newest-first; a dot on the unread ones only, and the difference
also spoken — an "Unread" text node in the link's accessible name, not colour alone; each row naming
the actor's display name, *mentioned you* / *assigned you* / *commented*, the issue or project, and a
relative time. The header carries **"Mark all read"** and no **New issue** button. A skeleton matching
the row layout flashes on a cold load and the layout does not jump when the data lands.

3. Sign in as a second user. **Expected**: none of the first user's rows.
4. Sign in as a user holding none. **Expected**: one quiet line. No illustration, no marketing.

---

## Walkthrough 3 — activating a row lands at the comment, and marks it read

1. As a user holding an unread `mention` on an issue comment, open `/notifications` and activate the
   row.

**Expected** (FR-014, FR-025): you land on
`/projects/<KEY>/issues/<N>/details#comment-<id>` — at that comment's own anchor, not the top of the
page. Go back: the row now carries no dot, and the sidebar count has dropped by one **without a
reload** (FR-036).

2. Activate an already-read row.

**Expected** (FR-027): you land in the same place and nothing changes; the moment it was first read is
unchanged. Verify in SQL rather than by eye:

```sql
SELECT id, read_at FROM notification WHERE user_id = '<id>' ORDER BY created_at DESC;
```

3. Activate a row carrying no comment (an `assignment`). **Expected**: the issue's detail page, with
   no fragment.

---

## Walkthrough 4 — "Mark all read" clears everything, in one call

1. As a user holding several unread rows **and more than 200 rows in total**, open `/notifications`.

**Expected**: exactly 200 rows render. No page control, no "load more", no infinite scroll (FR-022).
The sidebar count may read **more than 200** — it counts every unread row, not the listed ones
(FR-033, SC-012).

2. Press "Mark all read".

**Expected** (FR-028, FR-030, SC-011, SC-012): every dot disappears, the sidebar count vanishes
entirely — no zero — and neither a navigation nor a reload happened in between. Confirm the rows past
the 200-row bound were cleared too:

```sql
SELECT count(*) FROM notification WHERE user_id = '<id>' AND read_at IS NULL;   -- 0
SELECT count(*) FROM notification WHERE user_id = '<id>';                       -- unchanged
```

3. Press it again. **Expected**: nothing happens, no error, and no `read_at` already set has moved.
4. With nothing unread, reload. **Expected** (FR-021): "Mark all read" renders **disabled with its
   reason inline** — not hidden.

---

## Walkthrough 5 — the three recipient sets

Do these against a fresh project and take a **census** each time — the requirement is as much about
the rows that were *not* written:

```sql
SELECT user_id, actor_id, type, issue_id, project_id, comment_id FROM notification ORDER BY created_at;
```

| Do | Expect | Requirement |
| --- | --- | --- |
| Post an issue comment naming two other people | two `mention` rows, none for the author | FR-043, SC-004 |
| Post a comment naming yourself | zero rows | FR-038 |
| Post on an issue with an assignee and a different creator, naming neither | two `comment` rows | FR-047 |
| Post on an issue whose assignee **is** its creator | exactly one `comment` row | FR-047 |
| Post naming somebody who is also the issue's assignee | exactly one row, and its `type` is `mention` | FR-040, SC-006 |
| Post on a project with three members and one admin who holds no membership row | three `comment` rows; **zero** for that admin | FR-048, SC-007 |
| Post naming a deactivated user | zero rows, zero mail | FR-039, SC-005 |
| Post naming a `@[<uuid>]` that matches no user, alongside a real name | one row, for the real one | FR-044 |
| Post on a project that has no members | zero `comment` rows; mentions still written | Edge case |
| Change a project's status, apply a label, rename a column, add a member | **zero** rows of any type | FR-042, SC-003 |

---

## Walkthrough 6 — the assignment rule follows the field, through all four paths

| Do | Expect |
| --- | --- |
| Create an issue from `/projects/<KEY>/issues/new` with an assignee who is not you | one `assignment` row for them |
| Create a card from the board's inline "Add a card" composer under Assignee grouping | one `assignment` row — the same path (FR-050) |
| Set the assignee from the issue rail | one `assignment` row |
| Drag a card into somebody's lane under Assignee grouping | one `assignment` row |
| Assign an issue to **yourself**, by any of the four | zero rows |
| Re-select the assignee already set | zero rows (FR-051) |
| Drop a card into **Unassigned** | zero rows — the field is cleared, there is no new assignee |
| Reorder inside one assignee's lane | zero rows — the field is unchanged |
| Change only priority, column, title or due date | zero rows |

Every `assignment` row carries its issue and **`comment_id IS NULL`** (FR-052) — the
`notification_comment_id_matches_type` CHECK will not let it be otherwise.

---

## Walkthrough 7 — a comment edit tells only the people it newly names

1. Post a comment naming Ana. → Ana holds one `mention`.
2. Edit it to name Ana **and** Ben. → **Expected**: Ben holds one new `mention`; Ana holds **no**
   second row (FR-053, FR-055).
3. Edit it again to drop Ana. → **Expected**: Ana's original row is still there, unchanged, and no
   mail was recalled (FR-056).
4. Edit the body without changing any name. → **Expected**: zero new rows (FR-053).
5. Edit it to name somebody who already holds a `comment` row for it. → **Expected**: no second row
   (FR-055).
6. Any edit at all. → **Expected**: zero `comment`-type rows, ever (FR-054).

Confirm the edit is now transactional (FR-057): the body change and the new rows share a
`created_at` window and either both landed or neither did.

---

## Walkthrough 8 — deleting the target takes the notification with it

```sql
SELECT count(*) FROM notification;      -- before each step
```

| Do | Expect |
| --- | --- |
| Delete a comment carrying `mention` and `comment` rows | exactly those rows gone; every other row untouched |
| Delete an issue holding notifications **and** commented-on notifications | every row reaching the issue or its comments gone |
| Archive then delete a project | every row reaching the project, its issues and their comments gone; **no other project's rows touched** |
| Deactivate a user | their notifications neither deleted nor altered (FR-062) |

**There is no code to inspect for this.** All four are foreign keys and an `UPDATE`
([`data-model.md`](./data-model.md) §2). If a census shows a survivor, the fault is in the FK
declaration, not in a mutator.

---

## Walkthrough 9 — a rolled-back change leaves nothing behind

Force the causing transaction to fail — the readiest handle is `createIssue` against a project whose
`issue_counter` row is missing, which `create-issue.ts` already rolls back with
`TransactionRollbackError`.

**Expected** (FR-041, SC-010): zero notification rows survive, and zero messages were sent. The mail
dispatch is reached with an empty array, because `pendingMail` is only assigned on the committing
path.

---

## Walkthrough 10 — mail goes out, once per notification

With `SMTP_URL` pointing at a local catcher (MailHog, Mailpit, `smtp://localhost:1025`) and
`MAIL_FROM` set:

1. Post a comment naming three people.

**Expected** (FR-063, FR-069): **three** separate messages — no digest, no batching. Each is plain
text with **no HTML alternative part**. Each names the actor, what happened and the issue or project,
and carries a link that opens the same place the row's own link opens, `#comment-<id>` included. **No
query string, no token, no session.**

```sql
SELECT id, emailed_at, send_attempts FROM notification ORDER BY created_at DESC LIMIT 3;
```

**Expected**: `emailed_at` set and `send_attempts = 1` on all three — written together (FR-066).

---

## Walkthrough 11 — a dead mail host breaks nothing

1. Point `SMTP_URL` at a closed port (`smtp://localhost:1`), or unset `SMTP_URL` and `MAIL_FROM`
   entirely.
2. Post a comment.

**Expected** (FR-065, FR-070, SC-013): the comment saves. The response is **not** noticeably slower
than the same write with mail working — time both. The rows are written. Nothing crashed.

```sql
SELECT emailed_at, send_attempts FROM notification ORDER BY created_at DESC LIMIT 1;
--  emailed_at IS NULL, send_attempts = 1
```

The server log carries a `mail_send_failure` line and the browser was told nothing (FR-071).

---

## Walkthrough 12 — the retry schedule, by clock

**This one is not clickable — it is a test**, and that is the point. Eligibility is a function of the
row's age, not of when the timer happens to fire, so it is exercised by calling the sweep with an
explicit clock:

```bash
npx vitest run src/features/notifications/server/mail-sweep.test.ts
```

The scenarios, each seeding `created_at` and `send_attempts` directly and passing `now`:

| Row | Sweep at | Expect |
| --- | --- | --- |
| unsent, `send_attempts = 1`, 10 minutes old | now | **not** attempted — age has not passed 1 × 15 min |
| the same row, swept three more times inside those 15 minutes | now | still not attempted; the count is untouched |
| the same row, 16 minutes old | now | attempted once; count → 2 |
| unsent, `send_attempts = 4` | now | never attempted again |
| unsent, created 61 minutes ago, `send_attempts = 2` | now | never attempted again, whatever the count reads |
| unsent, `send_attempts = 0` (the process died before the immediate send returned) | now | attempted at once — the sweep gives it the attempt the restart lost |
| any of the above, with `emailed_at` set | now | not attempted |

**Expected throughout**: the count never passes 4; the in-app row is unchanged and still readable
after abandonment; no fake timers appear in any of these tests (FR-067, FR-068, SC-014).

Confirm the sweep is on **the one timer**:

```bash
grep -rn "setInterval" src --include='*.ts' | grep -v test
```

**Expected**: exactly one hit, `src/features/auth/server/sweep.ts`, inside `startSweep`, unchanged.

---

## Walkthrough 13 — nothing leaks

```bash
npx vitest run src/features/notifications/read-boundary.test.ts
```

**Expected** (FR-073, SC-002):

- `NotificationListItem` has exactly the seven keys [`data-model.md`](./data-model.md) §3 lists —
  no `sendAttempts`, no `emailedAt`, no `email`, no `readAt`;
- no module producing a DTO in this feature selects `user.email`;
- `publicUser` and `accountUser` in `src/features/auth/server/projections.ts` are byte-for-byte what
  R1 delivered;
- `markNotificationRead` against another user's row returns the same value as against an id that names
  nothing, and the row is unchanged;
- `markAllNotificationsRead` with a foreign user identifier supplied alongside it clears only the
  session's own rows — it takes no parameter, so there is nowhere to supply one.

---

## The gate

```bash
npm run verify
```

`style-check` → `type-check` → `test` → `build`, which is exactly what CI runs. **Green locally means
green in CI, and nothing else counts as done.**

Remember what a green `npm test` does *not* prove: it runs with `--passWithNoTests`, so gate 8 goes
green on an empty suite. The evidence for Principle VII is the commit order — each test committed
before the implementation that satisfies it, and observed failing for the intended reason first.

---

## What a browser cannot show you, and where the proof lives instead

| Claim | Why clicking cannot prove it | Where it is proved |
| --- | --- | --- |
| The notification row is in the **same transaction** as the change | a committed transaction looks identical to two successful writes | a rollback test: force the causing transaction to fail and census the table (FR-041, SC-010) |
| Two concurrent edits adding the same name write **one** row | you cannot race by hand | `Promise.all` over two real transactions against real PostgreSQL (FR-006, SC-006) |
| `CHECK (user_id <> actor_id)` is a **backstop**, not the mechanism | both give the same screen | one test asserts the constraint rejects a direct insert; the recipient tests assert no path reaches it (FR-004) |
| The response does not wait on the send | a fast host hides it | time a write against a closed SMTP port and against mail disabled (SC-013) |
| The attempt is counted **after** the send returns | the end state is the same either way | assert the count is 0 immediately after commit and 1 after the dispatch settles (FR-066) |
| `isMember` is **not** used for a project comment's recipients | with an admin who happens to be a member, both rules agree | seed an admin holding **no** membership row and assert zero rows for them (FR-048, SC-007) |
| An edit writes no `comment`-type row | absence in a UI is not evidence | a census before and after every edit (FR-054, SC-009) |
| The unread state is not colour alone | it looks fine either way | assert the row's **accessible name** carries "Unread" (FR-012, SC-016) |
| The count is not bounded by the 200-row list | invisible below 200 | seed 250 unread rows and assert the sidebar reads 250 (FR-033, SC-012) |
| The deletes cascade rather than run a hand-written delete | identical outcomes | read `schema.ts` — there is no `delete(notification)` anywhere in the feature (FR-032) |
