# Contract — mutators, the recipient writer, and the five reach-backs

**Feature**: R11 · **Spec**: [`spec.md`](../spec.md) · **Research**: [`research.md`](../research.md)

Two new Server Actions. Three new transaction-scoped writer functions. Five existing mutators gain a
caller. **Three existing deletes gain nothing** — their notification arm is a foreign key
([`data-model.md`](../data-model.md) §2).

---

## 1. `markNotificationRead` — Server Action

`src/features/notifications/actions.ts`

```ts
export type MarkNotificationReadPayload = { notificationId: unknown };

export type MarkNotificationReadResult =
  | { status: "ok" }
  | { status: "not-found" };

export async function markNotificationRead(
  input: MarkNotificationReadPayload,
): Promise<MarkNotificationReadResult>;
```

**Preamble, in this order** — the order every action in the repo already uses:

1. `assertSameOrigin({ headers: await headers() })` (FR-031, FR-072)
2. `const actor = await requireActor()` — an unauthenticated caller is redirected to sign-in and
   writes nothing (User Story 3 scenario 9, FR-031, FR-072)
3. `typeof input.notificationId !== "string" || trim() === ""` → `{ status: "not-found" }`, with no
   database call and **no coercion** (FR-031)

**The write** — one statement, scoped from the session:

```sql
UPDATE notification
   SET read_at = $now, updated_at = $now
 WHERE id = $notificationId
   AND user_id = $actor.id
   AND read_at IS NULL
```

**Outcomes**

| Situation | Rows updated | Returns | Requirement |
| --- | --- | --- | --- |
| The caller's own unread row | 1 | `ok` | FR-025 |
| The caller's own **already-read** row | 0 | `ok` — the first moment is unchanged | FR-027 |
| A row belonging to **somebody else** | 0 | `not-found` | FR-026, SC-002 |
| An id naming no row | 0 | `not-found` | FR-031 |
| A malformed id | — (refused before the query) | `not-found` | FR-031 |
| A non-UUID string reaching Postgres (`22P02`) | — | `not-found` | FR-031 |

A foreign row and a missing row are **indistinguishable** because `user_id = $actor.id` is in the
predicate: both update zero rows and both return the same value. That is FR-026 — "the 'This doesn't
exist' treatment, never a permission refusal, so a caller cannot learn that another user's
notification exists".

The already-read row returns `ok`, not an error: FR-027 makes marking read idempotent.

**After the write**: `refresh()` on `{ status: "ok" }` **and only then** — a failed write changed
nothing, and FR-025 requires that failure to be silent. `refresh()` is what FR-036 requires so the
sidebar count reflects the change without a navigation or a reload; the shared `(app)` layout is not
re-rendered by a soft navigation on its own ([`research.md`](../research.md) E-6).

**Nothing is deleted.** FR-032.

---

## 2. `markAllNotificationsRead` — Server Action

```ts
export type MarkAllNotificationsReadResult = { status: "ok" };

export async function markAllNotificationsRead(): Promise<MarkAllNotificationsReadResult>;
```

**It takes no parameters.** FR-029 requires the cleared set to be scoped server-side from the session
and requires a client-supplied identifier to change nothing; with no parameter there is nowhere to
supply one, so the requirement is structural rather than a check that could be forgotten. A caller
that sends a body anyway (Story 3 scenario 5) changes nothing, because nothing reads it.

Same preamble: origin, then actor.

**The write** — one statement, not one per row (FR-028):

```sql
UPDATE notification
   SET read_at = $now, updated_at = $now
 WHERE user_id = $actor.id
   AND read_at IS NULL
```

| Property | How | Requirement |
| --- | --- | --- |
| Every unread row the caller holds | no `LIMIT` — **including rows past the screen's 200-row bound** | FR-028, FR-022 |
| One call, not one per row | one `UPDATE` | FR-028 |
| Already-read rows untouched | `AND read_at IS NULL` | FR-030 |
| No other user's rows touched | `user_id = $actor.id` | FR-030, SC-011 |
| Pressed twice in quick succession | the second updates zero rows, returns `ok`, is not an error | Edge case |
| The caller holds none | zero rows, `ok` | FR-021's control is disabled anyway |

**After the write**: `refresh()`, unconditionally — the call always succeeds. SC-012 requires the
count to read zero "in the same interaction that 'Mark all read' clears the rows, with no navigation
and no reload in between", and FR-036 names revalidation-on-mutation as the only permitted mechanism.
**No polling, no socket, no live push is introduced anywhere.**

---

## 3. `src/features/notifications/server/write-notifications.ts`

Three functions. Each takes the caller's transaction as its first argument, writes inside it, and
returns the ids of the rows it actually inserted. **This is `writeActivity`'s shape**, which R5, R6,
R7, R9 and R10 already consume.

```ts
type NotificationTarget = { issueId: string } | { projectId: string };

export async function writeAssignmentNotifications(
  tx: Transaction,
  params: { issueId: string; assigneeId: string | null; actorId: string },
): Promise<string[]>;

export async function writeCommentNotifications(
  tx: Transaction,
  params: { commentId: string; target: NotificationTarget; actorId: string; body: string },
): Promise<string[]>;

export async function writeMentionDiffNotifications(
  tx: Transaction,
  params: {
    commentId: string;
    target: NotificationTarget;
    actorId: string;
    previousBody: string;
    nextBody: string;
  },
): Promise<string[]>;
```

### Rules every one of them applies

| Rule | Mechanism | Requirement |
| --- | --- | --- |
| Computed on the server from stored rows | every candidate id is checked against `user`; nothing the client sends is trusted | FR-037 |
| The actor is removed | `id <> $actorId` in the eligibility query | FR-038, SC-004 |
| Deactivated users are removed | `deactivated_at IS NULL` in the same query | FR-039, SC-005 |
| A token naming no user writes nothing, and stops nothing | that id simply does not come back from the query | FR-044 |
| Written in the causing transaction | every statement runs on `tx`, never `db` | FR-041, SC-010 |
| At most one row per person per comment | mention-wins subtraction **plus** `ON CONFLICT DO NOTHING` against the partial unique index | FR-006, FR-040, SC-006 |
| `.returning({ id })` | only rows actually inserted are mailed | FR-063, D-2 |

The eligibility query, once, for every set:

```sql
SELECT id FROM "user"
 WHERE id = ANY($candidateIds)
   AND deactivated_at IS NULL
   AND id <> $actorId
```

### `writeAssignmentNotifications`

Returns `[]` — writing nothing — when `assigneeId` is `null`, when `assigneeId === actorId`, or when
the assignee is deactivated. Otherwise inserts exactly one row:

```
{ userId: assigneeId, actorId, type: "assignment", issueId, projectId: null,
  commentId: null, sendAttempts: 0, createdAt: now, updatedAt: now }
```

`comment_id` is null on every `assignment` row, which the
`notification_comment_id_matches_type` CHECK enforces (FR-005, FR-052).

### `writeCommentNotifications` — called only by `createComment`

1. **Mention set** — ids from `MENTION_TOKEN_PATTERN` over `body`, deduplicated, through the
   eligibility query. One `mention` row each, carrying `commentId` and the comment's own target
   (FR-043, FR-046).
2. **Comment set** — for `{ issueId }`: `assignee_id` and `created_by` of that issue, deduplicated,
   so an issue whose assignee is its creator yields one row (FR-047). For `{ projectId }`: the
   `project_member` rows of that project — **the list, not the predicate**, so `isMember()` is not
   called and an admin holding no membership row receives nothing (FR-048, SC-007). Then through the
   eligibility query, then **minus every id already in the mention set** (FR-040).
3. Both sets inserted with `.onConflictDoNothing()`.

`type: "comment"` rows are written **here and nowhere else** (FR-049, FR-054).

### `writeMentionDiffNotifications` — called only by `updateComment`

Ids named by `nextBody` minus ids named by `previousBody`, through the eligibility query, inserted as
`mention` rows with `.onConflictDoNothing()` (FR-053).

| Requirement | How it holds |
| --- | --- |
| No `comment`-type row is ever written by an edit | the function takes no `type` and issues no comment-recipient query | FR-054 |
| No second row for anyone already holding one, of **either** type | the partial unique `(user_id, comment_id)` index, swallowed by `ON CONFLICT DO NOTHING` | FR-055 |
| A removed mention's row is neither deleted nor altered, and its mail is not recalled | the function only inserts; there is no `delete` and no `update` in this feature's write path | FR-056, FR-032 |
| An edit that changes no names writes nothing | the diff is empty | FR-053 |
| Two edits racing, each adding the same name | the unique index; exactly one row survives and neither call rejects | FR-006, SC-006 |

---

## 4. The five reach-backs

Each is an addition **inside a transaction the mutator already opens**, plus one line after it. None
changes the mutator's validation, its authorization, its activity writing or its **result shape** —
which the spec's *Out of Scope* forbids by name.

The shape, identical in all five ([`research.md`](../research.md) B-5):

```ts
let pendingMail: string[] = [];
const result = await db.transaction(async (tx) => {
  …                                               // unchanged
  pendingMail = await write…Notifications(tx, { … });
  …                                               // unchanged
});
dispatchNotificationMail(pendingMail);            // returns void; nothing awaits it
```

`pendingMail` is assigned only on the path that inserts, and read only after the transaction has
resolved — so a rollback reaches the dispatch with `[]` and a refusal returned from inside the
callback never assigns at all (FR-041, SC-010).

| # | File | Where | Guard already present there | Writes | Requirement |
| --- | --- | --- | --- | --- | --- |
| 1 | `src/features/issues/server/create-issue.ts` | inside the existing `db.transaction`, after `insert(issue).returning({id})` | the local `assigneeId` | `writeAssignmentNotifications` | FR-050 |
| 2 | `src/features/issues/server/update-issue.ts` | inside `runUpdateIssue`'s transaction, after `tx.update(issue)` | `"assigneeId" in fields` — only present when the value actually differs from the row | `writeAssignmentNotifications` | FR-050, FR-051 |
| 3 | `src/features/issues/server/move-issue.ts` | inside the existing transaction, in the `if (!laneUnchanged)` arm | `lane.field === "assignee"` | `writeAssignmentNotifications` | FR-050, FR-051 |
| 4 | `src/features/activity/server/create-comment.ts` | inside the existing `db.transaction`, after `writeActivity` | — | `writeCommentNotifications` | FR-043, FR-047, FR-048 |
| 5 | `src/features/activity/server/update-comment.ts` | inside a **new** transaction | — | `writeMentionDiffNotifications` | FR-053, FR-057 |

**FR-051 costs no new code.** Each of the three assigning mutators already computes whether it is
setting `assignee_id`, because each already needs that answer for its `field_changed` activity row.
A reorder inside one lane gives `laneUnchanged`; a drop into **Unassigned** gives
`lane.assigneeId === null`; a rail edit re-selecting the same person never puts `assigneeId` into
`fields`; creation with no assignee has `assigneeId === null`. All four of the spec's edge cases fall
out of conditions this feature does not write.

**FR-050's fourth path needs no fourth call site.** The board's inline "Add a card" composer reaches
`createIssue` through `createBoardCard` in `src/features/issues/actions.ts`, so it is already covered
by row 1.

### `updateComment` becomes transactional — reach-back 5 in full

Today: read `authorId`, refuse, parse body, one `db.update`. After:

```ts
// unchanged: the authorId read, the forbidden refusal, parseCommentBody, the invalid refusals
let pendingMail: string[] = [];
await db.transaction(async (tx) => {
  const [current] = await tx
    .select({ body: comment.body, issueId: comment.issueId, projectId: comment.projectId })
    .from(comment).where(eq(comment.id, input.commentId)).for("update");
  …
  await tx.update(comment).set(touched({ body })).where(eq(comment.id, input.commentId));
  pendingMail = await writeMentionDiffNotifications(tx, { …, previousBody: current.body, nextBody: body });
});
dispatchNotificationMail(pendingMail);
return { status: "ok" };
```

FR-057 requires it and the spec's *Reconciliations* records why: `OT-DATA-009` requires the rows in
the same transaction as the change, and the edit has no transaction today. `FOR UPDATE` is what makes
"the body it replaces" well defined when two edits race — without it both read the same previous body
and both compute the same diff. `update-issue.ts` and `move-issue.ts` both already open this way.

**The authorship check and the body parse stay where they are**, before the transaction: they are
reads that refuse, and moving them would change the refusal order R7 fixed (gate 7). Authorship is
immutable — no mutator writes `comment.author_id` — so this is not a TOCTOU regression.

### What none of the five does

- Change its result type, its refusal set or its refusal order.
- Change its validation or its authorization.
- Change or add an activity row.
- `await` the mail dispatch (FR-065, SC-013).
- Write a notification outside its transaction (FR-041).

---

## 5. The three deletes — **no contract, because no change**

| Mutator | File | Change |
| --- | --- | --- |
| `deleteComment` | `src/features/activity/server/delete-comment.ts` | **none** |
| `deleteIssue` | `src/features/issues/server/delete-issue.ts` | **none** |
| `deleteProject` | `src/features/projects/server/delete-project.ts` | **none** |

FR-058, FR-059, FR-060 and FR-061 are satisfied by the three `ON DELETE CASCADE` foreign keys on the
new table, inside the transaction each delete already runs. §4 specifies these as "Hard deletes,
**cascading in the database**". An explicit `tx.delete(notification)` in any of the three would be
dead code under Principle VI — removing it would change nothing observable — and in two of the three
it would be wrong unless it replicated the transitive closure by hand.

**Story 7's tests are written all the same, and they are the regression proof**: each deletes through
the real mutator and takes a full census of `notification` before and after (SC-015).

---

## 6. Server-boundary checklist (gate 3, Principle II, FR-072)

| Entry point | Origin | Actor | Authorization | Input validated | Safe result |
| --- | --- | --- | --- | --- | --- |
| `markNotificationRead` | `assertSameOrigin` | `requireActor` | `user_id = actor.id` in the `WHERE` — the system's one row-level read rule (FR-024) | `notificationId` parsed as a non-empty string, never coerced | `{ status }` only; no SQL, no configuration, no database detail |
| `markAllNotificationsRead` | `assertSameOrigin` | `requireActor` | `user_id = actor.id` in the `WHERE` | **no input exists** (FR-029) | `{ status: "ok" }` |
| `/notifications` page | — (a read) | `requireActor` → redirect to sign-in (FR-019) | `user_id = actor.id` in the query | no `searchParams` are read (FR-022) | `NotificationListItem[]` |
| `(app)` layout count | — (a read) | the actor it already loads | `user_id = actor.id` | none | a number |

No new Route Handler is added: sign-in remains the only mutation that is not a Server Action
(`AGENTS.md`). Every new server module carries `import "server-only"` or reaches it through `@/db`.
