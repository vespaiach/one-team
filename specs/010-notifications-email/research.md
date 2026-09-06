# Phase 0 — Outline & Research: Notifications and email

**Feature**: R11 · **Spec**: [`spec.md`](./spec.md) · **Date**: 2026-09-06

Thirty-nine decisions in six groups. Every one was reached by reading the tree at
`/Users/toannguyen/one-team/.worktrees/r11`, not by assuming what R1…R10 shipped. **No
NEEDS CLARIFICATION survives this phase**: the spec's twelve clarifications under
`### Session 2026-09-06` closed every product question, and the remaining questions were
mechanical ones the code answers.

Group A is the schema. Group B is the recipient computation and the five mutators it reaches into.
Group C is the three deletes. Group D is mail and the sweep. Group E is the screen and the sidebar
count. Group F is testing.

---

## A. The `notification` table

### A-1 — The table is added to `src/db/schema.ts`, and it is the only schema change

**Decision.** One `pgTable` appended to `src/db/schema.ts`, after `activity`. No existing table gains
a column, a `CHECK` or an index.

**Rationale.** `src/db/schema.ts` is a single file referenced directly by `drizzle.config.ts`
(`AGENTS.md`, *Architecture notes*), and the fifteen tables it holds are exactly the fifteen
`src/db/tables.ts` enumerates. §5 calls `notification` "the sixteenth and last table of the data
model" and FR-001 says so. The spec's *Obligations* section is explicit that **nothing earlier is
widened**: no table an earlier entry owns gains a column.

**Alternatives considered.** *Splitting the schema into one file per feature.* Would mean editing
`drizzle.config.ts` in the same change (`AGENTS.md` names this trap by hand) and touching fifteen
tables this feature does not own — gate 7. *A separate `notification` schema module imported into
`schema.ts`.* Same objection with more indirection (III).

### A-2 — Twelve columns, and `send_attempts` is the tenth

**Decision.**

| column | type | null | why |
| --- | --- | --- | --- |
| `id` | `uuid` PK, `$defaultFn(uuidv7)` | no | FR-001, R1's convention |
| `user_id` | `uuid` → `user.id` | no | the recipient |
| `actor_id` | `uuid` → `user.id` | no | who caused it |
| `type` | `text` + `CHECK` | no | FR-002 |
| `issue_id` | `uuid` → `issue.id` `ON DELETE CASCADE` | yes | FR-003, FR-059 |
| `project_id` | `uuid` → `project.id` `ON DELETE CASCADE` | yes | FR-003, FR-060 |
| `comment_id` | `uuid` → `comment.id` `ON DELETE CASCADE` | yes | FR-005, FR-058 |
| `read_at` | `timestamptz` | yes | FR-027 |
| `emailed_at` | `timestamptz` | yes | FR-066 |
| `send_attempts` | `integer NOT NULL DEFAULT 0` | no | FR-007 |
| `created_at` | `timestamptz` | no | ordering (FR-011) and the retry clock (FR-067) |
| `updated_at` | `timestamptz` | no | R1's convention, written through `touched()` |

**Rationale.** §5's field list is `user_id`, `actor_id`, `type`, one of `issue_id` / `project_id`,
optional `comment_id`, `read_at`, `emailed_at`. `created_at` / `updated_at` are the data-model
convention every table in `schema.ts` already carries (`activity` is the one exception — it has
`created_at` only, because §5 says its rows are never modified; a notification's `read_at` *is* a
modification, so it takes `updated_at` like every mutable table). `send_attempts` is the deliberate
widening the spec records twice — FR-007 and *Reconciliations*.

**Why `send_attempts` cannot be avoided.** `OT-OPS-002` bounds retries at three. Deriving the count
from `created_at` alone gives two wrong answers and no third: a sweep that re-sends every row whose
age is inside the hour re-sends on **every tick** (the timer fires every 5 minutes — twelve attempts,
not three), and a sweep that keys attempts off wall-clock buckets abandons the row across a process
restart because nothing durable says which bucket already ran. The count is the minimum durable state
the stated rule needs. It is `NOT NULL DEFAULT 0` so a row inserted by the recipient computation
never has to name it.

**Alternatives considered.** *A `notification_send_attempt` log table.* The spec forbids it by name:
*Out of Scope* — "A second timer, a job table or a delivery log. The retry state lives on the
notification row itself." *A `last_attempted_at` column instead of a count.* Spacing is already
derivable from `created_at` + the count (D-4); a second timestamp would be a second thing to keep in
step and still would not bound the attempts.

### A-3 — Five `CHECK` constraints

```
notification_type_valid              type in ('mention','assignment','comment')
notification_target_exactly_one      num_nonnulls(issue_id, project_id) = 1
notification_actor_not_recipient     user_id <> actor_id
notification_comment_id_matches_type (type = 'assignment') = (comment_id is null)
notification_send_attempts_range     send_attempts between 0 and 4
```

**Rationale.** The first three are FR-002, FR-003 and FR-004, and the first two copy `comment`'s and
`activity`'s existing `num_nonnulls(...) = 1` form verbatim — `comment_target_exactly_one` and
`activity_target_exactly_one` are both in `schema.ts` today. The fourth is FR-005 expressed the way
R7 already expressed the same shape: `activity_comment_id_matches_type` is
`(type = 'comment') = (comment_id is not null)`. The fifth makes FR-067's four-attempt ceiling a
database fact rather than only a sweep-side predicate, so a bug in the sweep cannot walk the counter
past the bound unnoticed.

**FR-004 is a backstop and must be seen to be one.** The recipient computation removes the actor
before any insert (B-3). The `CHECK` exists so that a future caller that forgets cannot write the row
— §3.6 says so in as many words: "`CHECK (user_id <> actor_id)` is a backstop, never the mechanism."
Its Red test asserts the constraint rejects a direct insert; the recipient tests assert no path ever
reaches it.

**Alternative considered.** *`pgEnum` for `type`.* §5's conventions forbid it outright — "`text` +
`CHECK` for enumerations, not `pgEnum`" — and `src/db/schema.test.ts` already asserts no `pgEnum` type
exists in the public schema. That test would fail.

### A-4 — Three indexes: two query indexes and one partial unique

```
notification_user_id_created_at_idx   (user_id, created_at)                  FR-008, FR-011, FR-022
notification_user_id_unread_idx       (user_id) WHERE read_at IS NULL        FR-008, FR-033, FR-028
notification_user_id_comment_id_idx   UNIQUE (user_id, comment_id)
                                        WHERE comment_id IS NOT NULL         FR-006
```

**Rationale.** FR-008 admits exactly two query patterns and no others; these are they. The unread
index is **partial** because every read of it filters `read_at is null` — the list count, the
sidebar count and `markAllNotificationsRead`'s `WHERE` — and a partial index is smaller and stays
small as rows are read. The third index is not a query index at all: it is FR-006's constraint, and
it must be partial because `assignment` rows carry `comment_id IS NULL` and Postgres would otherwise
treat every one of them as distinct anyway (nulls never conflict) — the partial form states the
intent instead of relying on that.

**No index on `emailed_at` or `send_attempts`.** The sweep's predicate reads them, but the sweep runs
every five minutes over a table whose unsent rows are bounded by an hour's traffic on a team of under
twenty people. FR-008 says indexes for the two named patterns "and for nothing else", and `AGENTS.md`
says "Add indexes for known query patterns only". Adding one would be speculation.

**No index on `issue_id`, `project_id` or `comment_id`.** `AGENTS.md` warns that PostgreSQL does not
index the referencing side of a foreign key, which means the three cascades in group C do a
sequential scan per delete. That is accepted: a delete of an issue or a project is a rare admin
action, and FR-008 forbids the index. Recorded so a reviewer meets the trade here rather than
finding it.

### A-5 — `user_id` and `actor_id` reference `user.id` with **no** `ON DELETE` clause

**Decision.** Plain `.references(() => user.id)`, matching `activity.actorId`, `comment.authorId` and
`issue.createdBy`.

**Rationale.** §4 is categorical: "a user is never deleted at all (`deactivated_at` instead)". A
cascade clause on a row that is never deleted is unreachable configuration, and FR-062 requires
deactivation to leave notifications untouched — which it does, because deactivation is an `UPDATE`.
The three tables that already store a person's identity make the same call.

**Alternative considered.** *`onDelete: "cascade"`, as `session` and `project_member` use.* Those two
are session state and membership, which the CLI's `admin:deactivate` path and R5's roster genuinely
churn. A notification is a historical fact about a person, filed beside `activity`.

### A-6 — `src/db/tables.ts` gains `"notification"`; `test-database.ts` needs no edit

**Decision.** One string added to `ALL_TABLES`, first in the list beside the other leaf tables.

**Rationale.** `truncateAllTablesStatement()` builds `TRUNCATE TABLE … RESTART IDENTITY CASCADE` from
that array, and `src/db/test-database.ts` calls it unchanged. Every persistence test in the repo
starts with `truncateTestDatabase()`; a table missing from the list leaks rows between test files,
and `fileParallelism: false` means that leak is silent and ordering-dependent. `CASCADE` makes the
position in the array irrelevant, so the entry goes where it reads best.

### A-7 — Migration `0008`, generated and inspected, never hand-written

**Decision.** `npm run db:generate` after `schema.ts` is edited, producing `drizzle/0008_*.sql`,
`drizzle/meta/0008_snapshot.json` and an appended `drizzle/meta/_journal.json` — all three committed
together (FR-009). `0000`…`0007` are never touched.

**Rationale.** `AGENTS.md`: generate with Drizzle Kit, inspect the generated SQL, commit the migration
plus its metadata; never edit a migration that may already have run. The SQL is inspected for three
things specifically — that the two partial indexes carry their `WHERE` clauses, that the three
cascade FKs render `ON DELETE cascade`, and that `send_attempts` renders `integer DEFAULT 0 NOT NULL`.
`src/db/migration.test.ts` and `src/db/test-setup.ts` run migrations against `TEST_DATABASE_URL`, so a
malformed migration fails the suite rather than production.

---

## B. Recipient computation and the five mutators

### B-1 — A new feature directory `src/features/notifications/`, with the writer following `writeActivity`'s precedent exactly

**Decision.** `src/features/notifications/server/write-notifications.ts` exports three functions, each
taking a Drizzle transaction as its first argument and returning the ids of the rows it inserted:

```
writeAssignmentNotifications(tx, { issueId, assigneeId, actorId })          → string[]
writeCommentNotifications(tx, { commentId, target, actorId, body })         → string[]
writeMentionDiffNotifications(tx, { commentId, target, actorId,
                                    previousBody, nextBody })               → string[]
```

**Rationale.** This is not a new pattern — it is the pattern R7 already established and R5, R6, R9 and
R10 already consume. `src/features/activity/server/write-activity.ts` exports
`writeActivity(tx, {...})`, and `create-issue.ts`, `update-issue.ts`, `move-issue.ts`,
`create-comment.ts` and five files under `src/features/projects/server/` all import it and call it
inside their own transaction. A notification writer with the same shape needs no invention and no
reviewer explanation.

Principle I's two-call-site rule is satisfied before the abstraction exists, not after:
`writeAssignmentNotifications` has **three** confirmed call sites (`createIssue`, `updateIssue`,
`moveIssue`) named by FR-050, and the mention parsing is shared by two (`createComment`,
`updateComment`) named by FR-043 and FR-053. Nothing here is extracted at its first call site.

**Alternatives considered.** *Put the writer in `src/features/activity/server/`.* It writes the
`notification` table, which this feature owns; `activity` owns `activity`. Mixing them would put two
features' write surfaces in one directory — the objection R10 recorded when it kept `moveIssue` in
`src/features/issues/`. *Put it in `src/lib/`.* `AGENTS.md`: "Business behaviour lives in
`src/features/<feature>/` … Not in generic utility files." *One function per mutator
(`notifyOnCreateIssue`, `notifyOnMoveIssue`, …).* Five near-identical functions, and it classifies by
mutator — which §3.6 explicitly rejects: "An `assignment` follows the field, not the mutator."

### B-2 — The mention set is parsed with R7's own `MENTION_TOKEN_PATTERN`, imported

**Decision.** `import { MENTION_TOKEN_PATTERN } from "@/features/activity/server/mention-resolve"` —
already exported there, already `/@\[([0-9a-f-]+)\]/g`, already the same token §5 fixes.

**Rationale.** The comment body and its token grammar are R7's (`comment.body`, §5). Re-declaring the
regexp here would be a second definition of one grammar that must not drift — and R7 has already paid
for that once: `comment-row.tsx` carries its own copy for rendering. A third copy is what Principle I
exists to prevent, and the export is right there.

**Why not `resolveMentions()` itself.** That function is `db`-scoped and returns display names for
rendering. The recipient computation needs ids, filtered by liveness, inside a caller's transaction.
Different question, different query — see B-3.

### B-3 — One transaction-scoped eligibility query does the actor and deactivation filtering, in SQL

**Decision.** Every recipient set passes through one query before any insert:

```sql
select id from "user"
 where id = any($candidates) and deactivated_at is null and id <> $actorId
```

built with Drizzle's `inArray` / `isNull` / `ne` against `tx`, never `db`.

**Rationale.** Four requirements collapse into this one query, which is why it is one query rather
than four filters. FR-037 (computed on the server from stored rows), FR-038 (actor removed), FR-039
(deactivated removed) and FR-044 (a token naming a user that does not exist writes no row and does not
stop the rest) are all consequences of asking the database which of these candidate ids is a live user
who is not the actor. `resolveMentions` already proves the shape — it does `inArray(user.id, ids)` and
lets the absent ones fall out — this adds the two predicates FR-038 and FR-039 name.

It runs on `tx`, not `db`, so the liveness read and the insert are the same snapshot (FR-041).

**Alternative considered.** *Filter in TypeScript after loading candidates.* Same result, more code,
and it re-derives in the application what a `WHERE` clause states once (III).

### B-4 — `mention` wins over `comment` in TypeScript, and the unique index is the backstop

**Decision.** `writeCommentNotifications` computes the mention set first, then subtracts it from the
comment set before inserting either (FR-040). Every insert additionally carries
`.onConflictDoNothing()`.

**Rationale.** FR-006 is explicit that the rule "MUST be enforced by the recipient computation and
MUST additionally be backed by a database constraint … so two concurrent writes cannot both insert
one". Two mechanisms, both required, and the spec says which is primary. The set subtraction is one
`Set.has` in a filter; the index is A-4's partial unique. `.onConflictDoNothing()` (untargeted) turns
the concurrent-edit race — the spec's own edge case, "two edits of one comment racing, each adding the
same name" — from a `23505` the caller must map into a row that simply is not inserted.

**This is why the insert uses `.returning({ id })`.** The ids that come back are the rows that were
actually written; the ones the conflict swallowed are not mailed. `dispatchNotificationMail` therefore
never mails a row somebody else already mailed (D-2).

**Alternative considered.** *Catch `isUniqueViolation` and continue*, the way `bootstrap.ts` does for
the seeded admin. That helper exists and works, but it aborts the whole `INSERT` statement — with a
multi-row insert, one conflicting recipient would lose the others. `ON CONFLICT DO NOTHING` is
per-row, which is what FR-043's "MUST NOT prevent the rest of the set from being written" wants.

### B-5 — The notification ids leave the transaction through a closure variable, not a widened return type

**Decision.** In each of the five mutators:

```ts
let pendingMail: string[] = [];
const result = await db.transaction(async (tx) => {
  …
  pendingMail = await writeAssignmentNotifications(tx, { … });
  …
});
dispatchNotificationMail(pendingMail);
```

**Rationale.** The spec's *Out of Scope* forbids the alternative in as many words: "Reworking the
mutators this feature reaches into. … their validation, authorization, activity writing and **return
shapes** are left as the entries that own them delivered them." `CreateIssueResult`,
`UpdateIssueResult`, `MoveIssueState`, `CreateCommentResult` and `UpdateCommentResult` are consumed by
Server Actions, by components and by twenty-odd existing test files; widening any of them to carry
notification ids would be both a violation and a large diff (gate 7).

The variable is assigned **only** on the path that inserts rows, and read **only** after
`db.transaction` has resolved — so a rolled-back transaction reaches the dispatch with `[]`, and a
refusal returned from inside the callback never assigns at all. That satisfies FR-041 and SC-010
structurally rather than by a check.

**Alternatives considered.** *Return `{ result, notificationIds }` from the transaction callback and
destructure.* `runUpdateIssue` has eleven early returns of refusal states inside its callback; every
one would have to be rewritten. *Send mail from the Server Action layer.* The action would need the
ids, which means widening the result shape — the thing forbidden above — and it would put delivery
logic in `actions.ts`, which today does origin, actor, parse, delegate, `refresh()` and nothing else.

### B-6 — `updateComment` gains a transaction and one read of the previous body

**Decision.** `update-comment.ts`'s single `db.update(...)` becomes `db.transaction(async (tx) => …)`
containing: `SELECT body FROM comment WHERE id = ? FOR UPDATE`, the `UPDATE`, then
`writeMentionDiffNotifications`.

**Rationale.** FR-057 requires it and the spec's *Reconciliations* records why: `OT-DATA-009` requires
the rows in the same transaction as the change, and the edit does not have one today. The `FOR UPDATE`
lock is what makes "the mention set of the saved body against the body it replaces" well defined when
two edits race — without it both edits read the same previous body and both compute the same diff.
`update-issue.ts` and `move-issue.ts` both already open with `.for("update")` on the row they write,
so this is the established shape.

The authorship check and the body parse stay **before** the transaction, exactly where they are: they
are reads that refuse, and moving them would change the refusal order R7 fixed (gate 7).

**Note for the reviewer.** `updateComment` today re-reads `authorId` outside any transaction and then
updates. After this change the author check is still outside and the body read is inside. That is not
a TOCTOU regression: authorship is immutable (`comment.author_id` has no mutator), and the row lock
covers the only value the diff depends on.

### B-7 — The assignment rule is written once and called three times, keyed on the field

**Decision.** `writeAssignmentNotifications(tx, { issueId, assigneeId, actorId })` returns `[]` unless
`assigneeId` is a non-null id different from `actorId` and belonging to a live user. Call sites:

| mutator | where | condition already computed there |
| --- | --- | --- |
| `createIssue` | inside the existing `db.transaction`, after `insert(issue)` | `assigneeId !== null` |
| `updateIssue` | inside `runUpdateIssue`'s transaction, after `tx.update(issue)` | `"assigneeId" in fields` |
| `moveIssue` | inside the existing transaction, in the `if (!laneUnchanged)` arm | `lane.field === "assignee"` |

**Rationale.** FR-050 and FR-051 are statements about `issue.assignee_id`, and each of the three
mutators **already computes** whether it is setting that field — `createIssue` has `assigneeId` as a
local, `updateIssue` builds a `fields` object and only puts `assigneeId` in it when the value actually
differs from the row, and `moveIssue` has `laneUnchanged` and a discriminated `lane`. So FR-051's
"a write that leaves the assignee unchanged … MUST write no `assignment` row" is not a new check
anywhere: it falls out of a condition each mutator already evaluates for its activity row. A drop into
**Unassigned** gives `lane.assigneeId === null`; a reorder inside a lane gives `laneUnchanged`; a rail
edit that re-selects the same person never puts `assigneeId` into `fields`. All three edge cases are
already handled by code this feature does not touch.

The board's inline "Add a card" composer needs no call site of its own: `createBoardCard` in
`src/features/issues/actions.ts` calls `runCreateIssue`, so FR-050's fourth path is the first one.
This is exactly what the spec's fourth clarification settles.

### B-8 — `createComment` is the only comment path that writes `comment`-type rows

**Decision.** `writeCommentNotifications` is called from `createComment` and from nowhere else;
`writeMentionDiffNotifications` inserts `type: "mention"` and has no branch that could produce
another type.

**Rationale.** FR-049 and FR-054 both say it, and the shape enforces it: the diff writer takes no
`type` parameter and has no comment-recipient query in it. FR-054's test ("an edit writes no
`comment`-type row") is therefore a census assertion over a function that structurally cannot, which
is the strongest form available without a constraint.

### B-9 — A project comment reads `project_member` rows, an issue comment reads two columns

**Decision.** For `{ projectId }`: `select user_id from project_member where project_id = ?`. For
`{ issueId }`: `select assignee_id, created_by from issue where id = ?`, deduplicated.

**Rationale.** FR-048 is emphatic — "the membership **list**, not the membership predicate" — and
§3.6 explains the consequence: an admin receives a project comment only where they were added
explicitly. `isMember()` in `src/features/projects/server/authorization.ts` is
`isAdmin(actor) || hasProjectMemberRow(...)`, so calling it here would mail every admin on every
project comment, which is the exact outcome §3.6 argues against. **`isMember` is not called anywhere
in this feature's recipient computation**, and that absence is deliberate enough to be worth a test.

FR-047's "where they are the same person, exactly one row" is a `Set`; the empty-project and
no-assignee edge cases fall out with no branch (an empty member list writes nothing; a null
`assignee_id` filters out with the deactivated ones).

---

## C. The three deletes need no code change at all

### C-1 — Three `ON DELETE CASCADE` foreign keys satisfy FR-058, FR-059, FR-060 and FR-061 outright

**Decision.** `deleteComment`, `deleteIssue` and `deleteProject` are **not edited**. The notification
arm of all three §4 cascades is `notification.comment_id`, `notification.issue_id` and
`notification.project_id`, each declared `{ onDelete: "cascade" }`.

**Rationale — traced delete by delete.**

- **A comment** (FR-058): rows carrying that `comment_id` go with it. `deleteComment` already issues
  one `DELETE` and returns; the cascade runs inside that statement.
- **An issue** (FR-059): rows with that `issue_id` go directly. Rows "reaching … any of its comments"
  go **twice over** — every `mention` and `comment` row carries the comment's own target as well as
  its `comment_id` (FR-046, FR-049), so it matches `issue_id` directly; and `comment.issue_id` is
  itself `ON DELETE CASCADE`, so those comments are deleted and take their notifications with them.
  `deleteIssue` already wraps its `DELETE` in `db.transaction`.
- **A project** (FR-060): `project_id` rows go directly; `issue.project_id` cascades to its issues,
  which cascade as above; `comment.project_id` cascades to project comments, which cascade as above.
  `deleteProject` already wraps its `DELETE` in `db.transaction` and already refuses a non-archived
  project.
- **FR-061** ("no intermediate moment"): a foreign-key cascade executes inside the parent `DELETE`
  statement, which is inside a transaction in all three cases. There is no window, by construction.
- **FR-062** (deactivation deletes nothing): deactivation is an `UPDATE` of `user.deactivated_at`,
  and A-5 gives `user_id` no `ON DELETE` clause. Nothing to do.
- **SC-015** ("zero notifications belonging to anything else are touched"): a cascade is keyed by the
  parent id.

**This is the largest single finding of Phase 0.** Three of the spec's seven user stories' worth of
"reach-back" turn out to be three lines in `schema.ts`.

**Alternative considered and rejected.** *Explicit `tx.delete(notification).where(...)` calls added to
each of the three mutators.* This is what "the `notification` arm … added to R5's `deleteProject`,
R6's `deleteIssue` and R7's `deleteComment`" sounds like it asks for, and it is wrong three times
over. It is dead code (VI) — the cascade fires whether or not the statement ran, so the statement's
removal would change no observable behaviour, which is the definition of dead. It is *incorrect* for
`deleteIssue` and `deleteProject` unless it replicates the transitive closure by hand, in the right
order, which is what the database already does. And §4 says these are "Hard deletes, **cascading in
the database**". The tests story 7 demands are written all the same, and they are the proof: each one
deletes through the real mutator and takes a census of `notification`.

### C-2 — `deleteComment`'s missing transaction is not this feature's problem

**Observation, recorded rather than fixed.** `delete-comment.ts` issues its `SELECT` and its `DELETE`
without a transaction, unlike `deleteIssue` and `deleteProject`. The cascade still runs atomically —
a single `DELETE` statement is its own transaction in PostgreSQL, and everything FR-058 requires
happens inside it. Nothing in this feature depends on the surrounding read being in the same
transaction. Wrapping it would be adjacent code this feature was not asked to touch (gate 7).

---

## D. Mail and the retry sweep

### D-1 — `src/lib/mail.ts`'s `sendMail` is reused unchanged; a notification-specific builder sits above it

**Decision.** `src/features/notifications/server/mail.ts` exports
`sendNotificationMail(notificationId)`, which loads what the message needs, calls
`sendMail({ to, subject, text })` from `@/lib/mail`, and writes the outcome to the row. `src/lib/mail.ts`
is **not edited**.

**Rationale.** `sendMail` already does exactly what FR-070 needs: it reads `SMTP_URL` and `MAIL_FROM`,
returns `"not_sent"` when either is missing rather than throwing, wraps `transport.sendMail` in a
`try/catch` and returns `"not_sent"` on any failure. An installation with no mail host therefore
cannot crash a write, and neither can an unreachable one. `src/features/auth/server/mail.ts` is the
precedent for the layer above: it builds a link from `APP_URL`, calls `sendMail`, and calls
`logMailSendFailure` on `"not_sent"`. This module is the same shape with a different message and one
extra step (the row write).

**Consequence, stated rather than hidden.** With no mail host configured, every notification row still
accrues four attempts across its hour and is then abandoned. That is four no-op function calls per
row, no I/O and no error. Treating "unconfigured" as "no attempt" was considered and rejected: it
would leave every row permanently eligible for the sweep until the hour bound retired it, which is
more work for the same end state, and it would need a second outcome value that `MailOutcome` does not
have. FR-070 asks that the write succeed, nothing crash, and the rows keep their in-app life — all
three hold.

### D-2 — `dispatchNotificationMail(ids)` is fire-and-forget, and returns `void`

**Decision.**

```ts
export function dispatchNotificationMail(notificationIds: string[]): void
```

It returns synchronously. Internally it starts the sends and attaches a `.catch` that calls
`logUnhandledServerError`. It is called by the five mutators **after** `await db.transaction(...)` has
resolved.

**Rationale.** FR-064 and FR-065 together are a precise instruction: the first attempt is issued by
the process serving the request (so not the sweep), after that request's transaction has committed (so
not inside it), and the response does not wait on it (so not awaited). A `void`-returning function is
the only signature under which a caller *cannot* accidentally await it, which makes SC-013 —
"its response time is indistinguishable from the same write with mail disabled" — a property of the
type rather than of caller discipline (III, VI).

The `.catch` is mandatory, not decorative: an unhandled rejection in a Node process is fatal under
some `--unhandled-rejections` settings, and FR-071 requires mail failures to reach the server log and
nothing else. `logUnhandledServerError` already exists in `src/features/auth/server/log.ts` and is
already what `startSweep` uses for the same purpose.

**This is safe on this deployment and would not be everywhere.** §7 fixes "self-hosted on a single
box" with one long-lived Node process. Work started after a response is sent survives, because nothing
freezes the process. On a serverless platform this pattern silently drops sends; there, the sweep
would be the only delivery path. Recorded because it is the one architectural assumption in this
feature that the deployment model makes true.

### D-3 — The attempt counter is written after the attempt returns, in one statement per outcome

**Decision.**

```
success:  UPDATE notification
             SET emailed_at = $now, send_attempts = send_attempts + 1, updated_at = $now
           WHERE id = $id AND emailed_at IS NULL
failure:  UPDATE notification
             SET send_attempts = send_attempts + 1, updated_at = $now
           WHERE id = $id AND emailed_at IS NULL
```

**Rationale.** The spec's tenth and eleventh clarifications fix both the ordering and its consequence:
after the attempt returns, on success in the same write that stamps `emailed_at`, on failure in a
write of its own; a process that dies mid-send records neither, so the message may go out twice, and
that duplicate is preferred to a loss. `send_attempts = send_attempts + 1` is an atomic in-database
increment — not a read-then-write, which `AGENTS.md` explicitly says is not protection.

The `AND emailed_at IS NULL` guard is what keeps the two sends of a duplicated message from producing
two stamps and two increments; the second one updates zero rows. It costs nothing and it is what makes
SC-014's "never passing 4" true even under the duplication the spec accepts.

**Alternative considered.** *Increment before the attempt.* The eleventh clarification rejects it by
name: it trades a duplicate for a message lost with no record it was never delivered.

### D-4 — Eligibility is `age > send_attempts × 15 minutes`, computed per row in SQL

**Decision.** The sweep's predicate, as one localized parameterized fragment:

```sql
emailed_at is null
and send_attempts < 4
and created_at > $now - interval '1 hour'
and created_at < $now - make_interval(mins => send_attempts * 15)
```

**Rationale.** The spec's twelfth clarification and FR-067 fix this exactly: eligible once the age
exceeds count × 15 minutes — roughly 15, 30 and 45 minutes after creation — and ineligible once the
age passes one hour or the count reaches 4, whichever comes first. It is computed **per row and in
SQL** because `send_attempts` varies row by row; no JavaScript expression can express it as a single
`WHERE`.

The interesting case is `send_attempts = 0`, which arises only when the immediate send never returned
(the process died, or D-2's dispatch never ran). `make_interval(mins => 0)` is zero, so the row is due
on the next tick — which is right: it has had no attempt at all and the sweep is the only thing left
that will give it one. FR-064 says the sweep "never issues a first attempt", and it does not: it picks
up "only rows the immediate send left unstamped", which is precisely this row.

**Why this is not tied to the timer's period.** FR-068 is explicit that the timer's period must not set
the retry spacing. `SWEEP_INTERVAL_MS` is 5 minutes; the spacing is 15. A row is skipped on the two
ticks inside its window and attempted on the third, and running the sweep any number of extra times
inside those fifteen minutes changes nothing — which is Story 5 scenario 10, assertable by passing
`now` to `sweepNotificationMail(now)` rather than by advancing fake timers.

**`AGENTS.md` on raw SQL** — "Keep any raw SQL localized, parameterized, typed, and tested" — is met:
one `sql` fragment in one module, every value a bound parameter, `now` a `Date` the caller passes, and
the predicate covered by seven clock-driven tests (F-4).

### D-5 — The sweep is added to `sweep()` in `src/features/auth/server/sweep.ts`, one line

**Decision.**

```ts
export async function sweep(now: Date = new Date()): Promise<void> {
  await db.delete(authAttempt)…;
  await db.delete(session)…;
  await db.delete(resetToken)…;
  await sweepNotificationMail(now);          // ← the change
}
```

`startSweep`, its `SWEEP_INTERVAL_MS`, its `unref()`, its `SIGTERM` handler, its `catch`, and
`bootstrap.ts` are **all untouched**.

**Rationale.** FR-068 requires the retry sweep to run on "the one in-process interval timer the
installation already runs for the sign-in throttle's sweep", and to introduce no queue, worker or
external scheduler. `startSweep` takes exactly one callback; `sweep` is that callback. Adding a
statement to `sweep` is the smallest change that satisfies FR-068 — one import, one line — and it
leaves the timer's own mechanics, which R1 tested thoroughly in `sweep.test.ts`, completely alone.

Crucially it also puts the composed behaviour behind a function the existing tests already call
directly: `sweep.test.ts` calls `await sweep(NOW)` with an explicit clock five times. Story 5's
scenarios can be written the same way, against a real database, with no timers and no `bootstrap`.

**Alternative considered.** *Compose in `bootstrap.ts`:*
`(deps.startSweep ?? startSweep)(async (now) => { await sweep(now); await sweepNotificationMail(now); })`.
This keeps `features/auth` from importing `features/notifications`, which is the honest argument for
it. It was rejected because it moves the composed behaviour into a function that has no name and no
direct caller in a test — verifying it means going through `bootstrap`, which asserts `APP_URL`,
probes the database and seeds an admin before it reaches the timer. Trading a clean import direction
for an untestable seam is the wrong side of Principle VII. **The import direction is recorded in the
plan's Complexity Tracking instead of being hidden.**

### D-6 — The message is plain text, built inline, with no template layer

**Decision.** `sendNotificationMail` builds a subject and a body as two template strings. There is no
templates directory, no HTML alternative part, no `text/html`, and no formatter module.

**Rationale.** The spec's eighth clarification, FR-069 and *Out of Scope* all say plain text with no
template layer, and `sendMail`'s parameter object is `{ to, subject, text }` — it has no `html` field
to fill even if one wanted to. §3.6 fixes what the message carries, not its wording: the actor, what
happened, the issue or project, and the deep link. A template layer with one caller is machinery, and
the spec calls it that.

The deep link is built the way `buildResetLink` builds its: `new URL(path, process.env.APP_URL)`. The
path is the same one the row's own link opens (E-4) — `/projects/<KEY>/issues/<N>/details` or
`/projects/<KEY>/details`, plus `#comment-<id>` where the row carries a comment. FR-069's "no session,
no token and no configuration detail" is structural: the URL carries no query string at all.

### D-7 — `sendNotificationMail` loads the recipient's address through a query of its own, and no projection is widened

**Decision.** One `SELECT` joining `notification` to `user` (recipient address, actor names), to
`issue` and `project` (the target's key, number and name) and to nothing else. `publicUser` and
`accountUser` in `src/features/auth/server/projections.ts` are **not edited**.

**Rationale.** FR-073 says the projection every endpoint reuses must stay as R1 fixed it and "this
feature MUST NOT widen it to carry a recipient's address into a response". `publicUser` deliberately
excludes `email`; `accountUser` includes it and is reserved for Accounts and Profile (§5, *Read
boundary*). A mail send is not a response — it is a server-side read that never reaches a client — so
it selects `user.email` directly and the two projections stay exactly as they are. This distinction is
worth the reviewer's attention, so it is also a test: no module under `src/features/notifications/`
that feeds a DTO selects `user.email`, and no DTO in this feature carries it.

---

## E. The screen, the row, and the sidebar count

### E-1 — `/notifications/page.tsx` follows the Labels page's shape

**Decision.** The page resolves the actor, awaits the unread count, renders `ScreenHeader` with the
"Mark all read" control in its `control` slot, and puts the list behind `<Suspense>` with a skeleton —
the exact structure of `src/app/(app)/settings/labels/page.tsx`.

**Rationale.** FR-020 requires the screen to render inside R2's shell with "Mark all read" in the
header's single per-screen control slot, and the **New issue** slot left empty. `ScreenHeader` already
declares `control?: ReactNode` and `newIssue?: ReactNode` and renders each only when passed — R10 was
the first to use `control`, through `ProjectHeader`; this is the second and it uses `ScreenHeader`
directly, because `/notifications` is not project-scoped and carries no tab pair.

FR-017's skeleton and FR-018's "renders nothing from a client cache" are the Suspense boundary and the
absence of any client-side fetch respectively. There is no `revalidate` export and no `fetch` in the
tree, so the page is dynamic and re-queries on every visit.

**The unread count is awaited before the header renders**, not inside the Suspense boundary, because
FR-021 requires "Mark all read" to render *disabled with its reason inline* when the caller holds no
unread rows — the control cannot be rendered at all without knowing. It is one count over the partial
unread index. The list, which is the expensive read, still streams.

### E-2 — The screen's DTO carries seven fields and neither `send_attempts` nor an email address

**Decision.**

```ts
type NotificationListItem = {
  id: string;
  type: "mention" | "assignment" | "comment";
  actorName: string;
  targetLabel: string;
  href: string;
  isUnread: boolean;
  createdAt: Date;
};
```

**Rationale.** `AGENTS.md`: "never expose database rows as public API or UI models — define an
explicit DTO at the boundary." FR-073 forbids `send_attempts` in any DTO or response and forbids
carrying a recipient's address into one. `read_at`'s *moment* is never rendered — FR-012 asks only
whether the row is unread — so the DTO carries a boolean and not a nullable date, which makes the
leak impossible rather than merely absent. `emailed_at`, `actor_id`, `user_id`, `comment_id`,
`issue_id` and `project_id` are all absent: the row's only navigational output is `href`, resolved
server-side (E-4).

### E-3 — Row activation is a `next/link` anchor whose `onNavigate` fires the mutator

**Decision.** `NotificationRow` is a Client Component rendering `<Link href={item.href}>` from
`next/link`, with `onNavigate` calling `markNotificationRead({ notificationId: item.id })` **without
awaiting it and inside a `.catch(() => undefined)`**. No toast, on any outcome.

**Rationale.** FR-014 and FR-025 want one gesture that both navigates and marks read, and the ninth
clarification and FR-025 want the navigation to win when the write loses: "the navigation MUST proceed
regardless, the row MUST be left unread and no toast MUST fire". An anchor navigates natively; not
awaiting the action means nothing can delay or cancel that; the `.catch` means a rejected action
cannot surface. `onNavigate` (verified present on Next 16.3.2's `Link` — `onNavigate?:
OnNavigateEventHandler` in `next/dist/client/app-dir/link.d.ts`) fires on client-side navigation, which
is what these in-app links do.

**Why not `react-aria-components`' `Link`.** `AGENTS.md` says React Aria first, and it also says to use
a React Aria component "before writing anything". React Aria's `Link` routes through a
`RouterProvider`, and this app has none — `src/app/provider.tsx` installs `I18nProvider` and nothing
else. Adding `RouterProvider` is a change to R2's shell provider affecting every link in the app: out
of this feature's scope and squarely gate 7. R2's own `Sidebar` reaches the same conclusion and uses
`next/link` for all five of its entries. An anchor is not a hand-built control being substituted for a
React Aria one; it is the platform element React Aria's `Link` itself renders, and it satisfies FR-074
natively — accessible name from its content, native focus indicator, `Enter` activation.

**"Mark all read", by contrast, is a React Aria `Button`** — it is a control, not a link, and
`react-aria-components/Button` with `isDisabled` is what R7 and R8 already use for exactly this.

### E-4 — The `href` is resolved on the server, from stored rows

**Decision.** `listNotifications` joins to `project` (for `key`) and `issue` (for `number`) and emits
a complete path per row: `/projects/<KEY>/issues/<N>/details#comment-<id>` or
`/projects/<KEY>/details#comment-<id>`, with the fragment omitted where `comment_id` is null.

**Rationale.** FR-014, FR-015 and §3.6 fix the destination and the anchor; R7 emits `id={`comment-${id}`}`
on every comment row in `comment-row.tsx`, verified. Composing the path client-side would mean shipping
project keys and issue numbers to the browser to be reassembled by string concatenation, and a mistake
there is a broken link with no server-side test to catch it. One `href` per row is one column of a
query and one assertion per test.

**A deleted target needs no special case.** The spec's edge case — a target deleted between the list
rendering and the row being activated — resolves itself: the row is gone with its target (group C), so
the next render omits it, and following a stale link reaches a page whose own loader calls
`notFound()`. "This doesn't exist", never a permission refusal, exactly as required — and nothing in
this feature implements it.

### E-5 — The sidebar count is a layout-level read passed down two props, and the accessible name carries it

**Decision.** `src/app/(app)/layout.tsx` awaits `countUnreadNotifications(actor.id)` beside its
existing `listProjectsForSidebar()` and passes `unreadNotificationCount` through `AppShell` to
`Sidebar`. `Sidebar` renders:

```tsx
<Link href="/notifications" aria-label={ariaLabel} className={NAV_LINK_CLASSES}>
  Notifications
  {count > 0 ? <span aria-hidden="true">{count}</span> : null}
</Link>
```

with `ariaLabel` being `` `Notifications, ${count} unread` `` when `count > 0` and `"Notifications"`
otherwise.

**Rationale.** FR-033 puts the count on every authenticated screen, which is what the shared layout
is. FR-035 requires the value to be "part of the entry's accessible name rather than conveyed by a
visual badge alone" — hence `aria-label` carrying the number and `aria-hidden` on the visual badge, so
assistive technology hears it once and sighted users see it once. FR-034 requires no count and no zero
at zero, which is the ternary and the conditional label together.

FR-033's second sentence matters for the query: the count is **not** bounded by FR-022's 200-row list
cap, so it is `SELECT count(*) … WHERE user_id = ? AND read_at IS NULL` with no `LIMIT` — a partial
index scan (A-4). SC-012 asserts precisely that it can exceed the number of unread rows the screen
shows.

**Two props, not one.** `AppShell` forwards to `Sidebar` and renders nothing with the count itself,
which is the same pass-through it already does for `projects`.

### E-6 — Both mutators call `refresh()`; nothing polls, sockets or pushes

**Decision.** `markAllNotificationsRead` and `markNotificationRead` both call `refresh()` from
`next/cache` on success and only on success.

**Rationale.** FR-036 is written about "a write that changes the caller's unread set", not about one
of them, and it names the mechanism: "Revalidation on mutation is the only refresh mechanism
permitted; polling, a socket and any live push MUST NOT be introduced." `refresh()` refreshes the
client router from within a Server Action (verified in `next/dist/docs/01-app/03-api-reference/
04-functions/refresh.md`), which re-renders the route tree — including `(app)/layout.tsx`, where the
count lives. Thirteen call sites across five existing `actions.ts` files already use it for exactly
this purpose.

**Why `markNotificationRead` needs it too.** `(app)/layout.tsx` is shared between `/notifications` and
every issue and project route, so a soft navigation from a row to its target does **not** by itself
re-render that layout. Without `refresh()` the sidebar count would stay stale until a hard reload —
which FR-036 forbids in the same sentence. This is the subtlest requirement in the feature and it gets
its own test: activate a row, assert the sidebar count dropped, with no navigation and no reload
(SC-012's sibling for the single-row case).

**Only on success.** A failed mark-read changed nothing, so there is nothing to revalidate, and
FR-025 requires that failure to be silent.

### E-7 — Both mutators refuse a foreign row as "not found", and the bound is server-side

**Decision.** `markNotificationRead` runs
`UPDATE notification SET read_at = $now, updated_at = $now WHERE id = $id AND user_id = $actorId AND read_at IS NULL`
and reports `not-found` when the id is malformed, names no row, **or** names somebody else's row.
`markAllNotificationsRead` runs
`UPDATE notification SET read_at = $now, updated_at = $now WHERE user_id = $actorId AND read_at IS NULL`
and accepts no input at all.

**Rationale.** Four requirements fall out of those two `WHERE` clauses. FR-026: a foreign row is
indistinguishable from a missing one because `user_id = $actorId` is in the predicate, so both update
zero rows and both report the same thing — a caller cannot learn another user's notification exists.
FR-027: `AND read_at IS NULL` makes a second call update zero rows and leave the original moment, and
returning `ok` rather than an error makes it idempotent. FR-029: `markAllNotificationsRead` has **no
parameters**, so "a client-supplied identifier MUST change nothing" is not a check that could be
forgotten — there is nowhere to supply one. FR-028's "in one statement rather than one call per row"
is one `UPDATE`, and it necessarily includes rows past FR-022's 200-row bound because the statement
has no `LIMIT`.

FR-031's explicit rejection of a malformed identifier is a parse in the action layer before the
mutator: a non-string or empty `notificationId` returns `not-found` without touching the database, and
never a coerced value. Postgres' `22P02` on a non-UUID string is caught the way `update-issue.ts`
already catches it rather than being allowed to escape as a 500.

FR-032 — no mutator deletes a row — is satisfied by there being no `delete` anywhere in this feature's
code. A row leaves only through group C's cascades.

### E-8 — The list is `LIMIT 200`, ordered `created_at desc, id desc`

**Decision.** `listNotifications(userId)` orders by `created_at` descending, tie-broken by `id`
descending, and takes 200. There is no cursor, no offset and no `searchParams` read.

**Rationale.** FR-022 and the seventh clarification: at most the 200 most recent, no page control, no
infinite scroll, rows past the bound not listed and not deleted. The `id` tie-break is free
correctness — ids are UUIDv7 and therefore time-ordered, so `id desc` agrees with `created_at desc`
and makes the order total, which is what lets a test assert an exact sequence when two rows share a
millisecond (R10 established the same `(sort_order, id)` reasoning).

**Nothing about the bound reaches the count or the clear.** FR-022 says so, and A-4's two separate
indexes are why it costs nothing: the list uses `(user_id, created_at)` with a limit, the count and the
clear use the partial unread index over the whole set.

---

## F. Testing

### F-1 — Every persistence rule is tested against real PostgreSQL; nothing that matters is mocked

**Decision.** All recipient-computation, cascade, constraint, mutator and sweep tests are `*.test.ts`
in the `server` project — node environment, `fileParallelism: false`, `TEST_DATABASE_URL` migrated by
`src/db/test-setup.ts`, each file opening with `truncateTestDatabase()`. Components are `*.test.tsx`
in the `ui` project.

**Rationale.** `AGENTS.md`: "Persistence tests MUST run against a real PostgreSQL instance on a
separate database — invariants are enforced by constraints and row locks, which a mock cannot verify."
Four of this feature's rules are constraints (A-3), one is a partial unique index under concurrency
(B-4), three are foreign-key cascades (C-1) and one is an atomic increment (D-3). A mock verifies none
of them.

`nodemailer` is the exception and it is already the house pattern: eight existing test files do
`vi.spyOn(nodemailer, "createTransport").mockReturnValue({ sendMail })`. Mail tests use that, so
"the host refuses" is a rejected promise and "the host accepts" is a resolved one, both deterministic.

### F-2 — The three Red steps that are easy to get wrong

**`send_attempts` reaching 1 after the immediate send.** The test must observe the count at 0
immediately after the causing transaction commits and at 1 after the dispatch has settled — asserting
only the second would pass against an implementation that increments before the attempt, which the
eleventh clarification forbids. The Red step therefore asserts both, and asserts that a *failed* send
leaves `emailed_at` null with the count at 1.

**The mention-wins rule.** A test where one person is both mentioned and a listener must assert
`rows.length === 1` **and** `rows[0].type === 'mention'`. Asserting only the count passes against an
implementation that writes the `comment` row and drops the `mention`, which inverts FR-040.

**Every "no row is written" scenario is a census, not an absence.** FR-042, FR-051, SC-003, SC-004,
SC-005 and SC-008 are all statements about what did *not* happen. Each test takes a full
`select().from(notification)` before and after and compares, rather than querying for the row it
expects to be missing — the same discipline R10 applied to its ordering tests, and for the same
reason: a query that finds nothing also finds nothing when the write went somewhere unexpected.

### F-3 — The concurrency test that FR-006 actually requires

**Decision.** Two `updateComment` calls adding the same name, issued with `Promise.all` against the
real database, asserting exactly one row exists afterwards and neither call rejected.

**Rationale.** FR-006 requires the constraint "so two concurrent writes cannot both insert one", and
SC-006 names "two concurrent edits that add the same name" explicitly. `AGENTS.md`: "A read followed
by a write is not protection." The set subtraction in B-4 is the read-then-write; the partial unique
index plus `ON CONFLICT DO NOTHING` is the protection, and only a real database with two real
transactions demonstrates it. R10's `move-issue-race.test.ts` and R5's `update-column-race.test.ts` are
the shape to follow.

### F-4 — The retry schedule is tested by clock, never by timers

**Decision.** Every sweep test calls `await sweep(now)` or `await sweepNotificationMail(now)` with an
explicit `Date`, seeding rows with chosen `created_at` and `send_attempts` values. No `vi.useFakeTimers`
and no `startSweep` anywhere in them.

**Rationale.** FR-067 and FR-068 make eligibility a function of the row's age and explicitly not of
how often the sweep runs, and SC-014 says the schedule must be "verifiable by clock rather than by how
often the sweep runs". Passing `now` tests exactly that claim. It also makes Story 5 scenario 10
directly expressible: call the sweep three times inside the first fifteen minutes, assert the count is
untouched each time, advance `now` past fifteen minutes, call once more, assert one attempt.

`startSweep`'s own mechanics — the interval, the `unref`, the `SIGTERM` clear, the `catch` — are R1's
and are already covered by `src/features/auth/server/sweep.test.ts`. This feature adds no test for
them and changes none of them (D-5).

### F-5 — Two boundary tests that assert an absence, because the absence is the requirement

**`user.email` reaches no DTO and no component.** FR-073. A test that reads the source of every module
under `src/features/notifications/` that produces a DTO and asserts none selects `user.email`, and a
DTO-shape test asserting `NotificationListItem`'s keys exactly. The precedent is
`src/features/auth/no-secret-leaks.test.ts` and `src/features/auth/read-boundary.test.ts`.

**`send_attempts` reaches no response.** FR-007 and FR-073 both end on it. Same test, same file.

**`isMember` is not called by the recipient computation.** B-9. A project comment's recipients are the
`project_member` rows; an admin holding no row there must receive nothing (FR-048, SC-007). The
positive test — seed an admin with no membership row, post a project comment, assert zero rows for
them — is the requirement, and it is stronger than a source scan, so the source scan is not written.

### F-6 — The screen's tests query by role and visible text, and prove the dot is not colour alone

**Decision.** `notifications-screen.test.tsx` and `notification-row.test.tsx` query by `role` and
accessible name. The unread indicator is asserted through the row's accessible name (an "Unread"
text node, visually hidden) and not through a class name.

**Rationale.** `AGENTS.md`: query by role, label and visible text before `data-testid`; never convey
state through colour alone. FR-012 and SC-016 make the second one a functional requirement, not a
style preference — a test that asserts a CSS class would pass for a design that is colour-only. The
sidebar's count is asserted the same way: `getByRole("link", { name: "Notifications, 3 unread" })`.

`@react-aria/test-utils` is not installed and is not added (IV). Keyboard operation of "Mark all read"
is verified with explicit key events, as R7 through R10 already do.

---

## Unknowns

**None outstanding.** Every NEEDS CLARIFICATION candidate resolved:

| Candidate | Resolved by |
| --- | --- |
| Does the sweep issue the first attempt? | Spec clarification 3; FR-064; D-2 |
| How is the three-retry bound enforced across a restart? | Spec clarification 5; FR-007; A-2 |
| What does the mail look like? | Spec clarification 8; FR-069; D-6 |
| Is the list paged? | Spec clarification 7; FR-022; E-8 |
| Where does the timer live and what does it call? | Read `sweep.ts`, `bootstrap.ts`, `instrumentation.ts`; D-5 |
| Is `nodemailer` wired up already? | Read `src/lib/mail.ts` and `features/auth/server/mail.ts`; D-1 |
| Do the three deletes need code? | Read all three mutators and §4; **no** — C-1 |
| Does `ScreenHeader` have a control slot? | Read it; yes, `control?: ReactNode`; E-1 |
| Does R7 emit `#comment-<id>`? | Read `comment-row.tsx:237`; yes; E-4 |
| Does `Link` have `onNavigate` on the pinned Next? | Read `link.d.ts:170`; yes; E-3 |
| Is there a `RouterProvider`? | Read `src/app/provider.tsx`; **no**; E-3 |
| Does `refresh()` reach a layout? | Read Next 16's own `refresh.md`; it refreshes the router; E-6 |

**One design question is carried into implementation rather than resolved on paper**, and it is
recorded in the plan: `refresh()`'s effect on the shared `(app)` layout after a soft navigation
(E-6). The requirement is unambiguous (FR-036) and the mechanism is the one the repo already uses
thirteen times; what cannot be settled by reading is whether one `refresh()` call in
`markNotificationRead` is sufficient in the presence of a simultaneous client-side navigation. The
task list carries an explicit test for it, and the fallback — `revalidatePath("/", "layout")`, already
imported in `src/features/issues/actions.ts` — needs no new dependency and no design change.
