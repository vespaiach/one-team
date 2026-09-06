# Phase 1 — Data Model: Notifications and email

**Feature**: R11 · **Spec**: [`spec.md`](./spec.md) · **Research**: [`research.md`](./research.md)

One new table, one migration, one line added to `src/db/tables.ts`. **No existing table gains a
column, a constraint or an index**, and no existing migration is edited.

---

## 1. The `notification` table

The sixteenth and last table of §5's data model (FR-001). Appended to `src/db/schema.ts` after
`activity`.

### Columns

| Column | Type | Null | Default | Requirement |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | no | `$defaultFn(uuidv7)`, **no database default** | FR-001 |
| `user_id` | `uuid` → `user(id)` | no | — | FR-001, FR-024 |
| `actor_id` | `uuid` → `user(id)` | no | — | FR-001, FR-012 |
| `type` | `text` | no | — | FR-002 |
| `issue_id` | `uuid` → `issue(id)` `ON DELETE CASCADE` | yes | — | FR-003, FR-059 |
| `project_id` | `uuid` → `project(id)` `ON DELETE CASCADE` | yes | — | FR-003, FR-060 |
| `comment_id` | `uuid` → `comment(id)` `ON DELETE CASCADE` | yes | — | FR-005, FR-058 |
| `read_at` | `timestamptz` | yes | — | FR-025, FR-027 |
| `emailed_at` | `timestamptz` | yes | — | FR-066 |
| `send_attempts` | `integer` | no | `0` | **FR-007** |
| `created_at` | `timestamptz` | no | — | FR-011, FR-067 |
| `updated_at` | `timestamptz` | no | — | FR-001, written through `touched()` |

Neither `user_id` nor `actor_id` carries an `ON DELETE` clause: a user is never deleted (§4), and
`activity.actor_id`, `comment.author_id` and `issue.created_by` all make the same call. See
[`research.md`](./research.md) A-5.

### `send_attempts` — the one deliberate widening of §5's field list

§5 enumerates the row's fields and stops at `emailed_at`. This column is added on top of that list,
for one reason recorded in FR-007, in the spec's *Reconciliations*, and again here so it is not
mistaken for drift:

- `OT-OPS-002` bounds the retries at three. Enforcing a bound requires knowing how many attempts have
  been made.
- Deriving that from wall-clock alone has two failure modes and no third: a sweep firing every five
  minutes over an hour-long window makes **twelve** attempts, not three; and a sweep keyed to
  wall-clock buckets forgets which bucket already ran the moment the process restarts.
- The column is the minimum durable state the stated rule needs.

Its arithmetic is fixed by two clarifications and by FR-007, FR-066 and FR-067:

| Moment | Value |
| --- | --- |
| Row inserted, inside the causing transaction | `0` |
| Immediate post-commit send has **returned**, success or failure | `1` |
| Each sweep retry that has **returned** | `+1` |
| Ceiling — the row is never attempted again | `4` |

It counts every attempt, the immediate one included, so "at most three retries" and "at most four
attempts" are the same bound. It is incremented **after** the attempt returns, never before — so a
process that dies mid-send records neither the stamp nor the attempt and the message may go out twice,
which the spec prefers to losing it.

**It is exposed by nothing.** No read query in this feature selects it into a DTO, no component
receives it, no Server Action returns it, and `NotificationListItem` (§3 below) has no field for it.
FR-007 and FR-073 both end on that sentence, and [`research.md`](./research.md) F-5 makes it a test.

### Constraints

| Name | Predicate | Requirement |
| --- | --- | --- |
| `notification_type_valid` | `type in ('mention','assignment','comment')` | FR-002 |
| `notification_target_exactly_one` | `num_nonnulls(issue_id, project_id) = 1` | FR-003, `OT-INV-010` |
| `notification_actor_not_recipient` | `user_id <> actor_id` | FR-004 |
| `notification_comment_id_matches_type` | `(type = 'assignment') = (comment_id is null)` | FR-005 |
| `notification_send_attempts_range` | `send_attempts between 0 and 4` | FR-007, FR-067 |

The first two copy the form `comment_target_exactly_one` and `activity_target_exactly_one` already use
in `schema.ts`. The fourth copies `activity_comment_id_matches_type`. §5's conventions forbid `pgEnum`
and `src/db/schema.test.ts` already asserts none exists, so `type` is `text` + `CHECK`.

**`notification_actor_not_recipient` is a backstop and nothing else.** §3.6 says so: the actor is
removed from every recipient set before any row is written (FR-038), and the constraint exists so a
future caller that forgets is stopped rather than silently notifying somebody about their own action.
Its test asserts the constraint rejects a direct insert; the recipient tests assert no path reaches it.

### Indexes

| Name | Definition | Serves |
| --- | --- | --- |
| `notification_user_id_created_at_idx` | `(user_id, created_at)` | the list, newest-first, `LIMIT 200` — FR-008, FR-011, FR-022 |
| `notification_user_id_unread_idx` | `(user_id) WHERE read_at IS NULL` | the sidebar count and `markAllNotificationsRead` — FR-008, FR-033, FR-028 |
| `notification_user_id_comment_id_idx` | `UNIQUE (user_id, comment_id) WHERE comment_id IS NOT NULL` | **FR-006** — one notification per person per comment, enforced under concurrency |

FR-008 admits exactly two query patterns "and for nothing else"; the third index is not a query index
but FR-006's constraint. Nothing indexes `emailed_at`, `send_attempts`, `issue_id`, `project_id` or
`comment_id` — see [`research.md`](./research.md) A-4 for the cascade-scan trade that accepts.

---

## 2. Cascades — where a notification row goes to die

FR-032 forbids any mutator from deleting a notification. A row leaves the table by exactly one route:
a foreign-key cascade fired by the delete of the thing it points at.

| Delete | Reaches notifications by | Code change |
| --- | --- | --- |
| **`deleteComment`** (R7) | `notification.comment_id → comment ON DELETE CASCADE` | **none** |
| **`deleteIssue`** (R6) | `notification.issue_id → issue`, and transitively `comment.issue_id → issue` then `notification.comment_id → comment` | **none** |
| **`deleteProject`** (R5) | `notification.project_id → project`; `issue.project_id → project` then the issue path above; `comment.project_id → project` then the comment path above | **none** |
| **`deactivateUser`** (R3) | nothing — deactivation is an `UPDATE` | **none** (FR-062) |

Every `mention` and `comment` row carries the comment's own target as well as its `comment_id`
(FR-046, FR-049), so a notification on a deleted issue's comment is reached twice over. FR-061's
"no intermediate moment at which a deleted row is gone and a notification pointing at it is not" is
structural: a cascade executes inside the parent `DELETE`, and all three deletes already run in one
transaction (`deleteIssue` and `deleteProject` explicitly; `deleteComment` as a single statement).

**No `tx.delete(notification)` statement is written anywhere in this feature.** It would be dead code
under Principle VI — removing it would change nothing observable — and for `deleteIssue` and
`deleteProject` it would be wrong unless it replicated the transitive closure by hand. §4 is explicit
that these are "Hard deletes, **cascading in the database**". The tests Story 7 demands are still
written, against the real mutators, and they are the proof.

---

## 3. Boundary types

Database rows never leave the server. Two explicit DTOs, and one that does not exist.

### `NotificationListItem` — the only shape the screen sees

```ts
export type NotificationType = "mention" | "assignment" | "comment";

export type NotificationListItem = {
  id: string;
  type: NotificationType;
  actorName: string;
  targetLabel: string;
  href: string;
  isUnread: boolean;
  createdAt: Date;
};
```

| Field | From | Requirement |
| --- | --- | --- |
| `id` | `notification.id` | the mark-read call FR-025 makes |
| `type` | `notification.type` | FR-013 — rendered as *mentioned you* / *assigned you* / *commented* |
| `actorName` | `displayName(actor)` — `src/lib/display-name.ts` | FR-012 |
| `targetLabel` | `WEB-142 · <issue title>` or `<project name>` | FR-012 |
| `href` | composed server-side, §4 below | FR-014, FR-015 |
| `isUnread` | `read_at is null` | FR-012 |
| `createdAt` | `notification.created_at` | FR-012, relative time |

**Absent by design, each for a stated reason.** `send_attempts` and `emailed_at` — FR-073, delivery
state a screen never reads. The recipient's `email` — FR-073, and `publicUser` deliberately excludes
it. `read_at`'s moment — FR-012 asks only *whether* the row is unread, so the DTO carries a boolean
and the moment cannot leak. `user_id`, `actor_id`, `comment_id`, `issue_id`, `project_id` — the row's
only navigational output is `href`, resolved on the server.

`actorName` renders unchanged when the actor has since been deactivated or lost their membership
(Story 1 scenario 10): the join is on `user.id` and reads no `deactivated_at`.

### `NotificationMailFacts` — internal to the mail module, never returned

```ts
type NotificationMailFacts = {
  recipientEmail: string;
  actorName: string;
  happening: string;
  targetLabel: string;
  link: string;
};
```

Server-only, consumed by `sendNotificationMail` and by nothing else. It is the one place
`user.email` is selected in this feature, and it never crosses a response boundary — which is why
`publicUser` and `accountUser` in `src/features/auth/server/projections.ts` are **not edited**
(FR-073, [`research.md`](./research.md) D-7).

### The DTO that does not exist

There is no `Notification` DTO carrying the row. `AGENTS.md` forbids exposing database rows as UI
models, and the two shapes above are the complete boundary. `typeof notification.$inferSelect` is used
only inside `src/features/notifications/server/` and inside tests.

---

## 4. Derived values

### The deep link

Composed in `listNotifications` and again in `sendNotificationMail`, from stored rows, so both open
the same place (FR-069):

| Row | Path |
| --- | --- |
| `issue_id` set, `comment_id` null | `/projects/<project.key>/issues/<issue.number>/details` |
| `issue_id` set, `comment_id` set | `…/details#comment-<comment_id>` |
| `project_id` set, `comment_id` null | `/projects/<project.key>/details` |
| `project_id` set, `comment_id` set | `/projects/<project.key>/details#comment-<comment_id>` |

The `#comment-<id>` anchor is R7's, emitted by `comment-row.tsx` on every comment row; this feature
targets it and adds nothing to it (FR-014). The mail's link is the same path resolved against
`APP_URL`, which `bootstrap.ts` already asserts is set. **No query string, ever** — FR-069 forbids a
session, a token or configuration detail in a message.

### Retry eligibility

A row is due for a sweep attempt when all four hold (FR-067, FR-068):

```
emailed_at IS NULL
send_attempts < 4
created_at >  now - interval '1 hour'
created_at <  now - (send_attempts × 15 minutes)
```

Which places the attempts at roughly 15, 30 and 45 minutes after creation and abandons the row at the
hour or at four attempts, whichever comes first. `send_attempts = 0` — the row whose immediate send
never returned — is due at once, which is right: it has had no attempt and the sweep is what is left.
The timer's five-minute period changes *when a due row is picked up* and never *how many attempts it
gets*.

---

## 5. State

A notification has two independent, monotonic, one-way pieces of state. Nothing moves backwards.

**Read state.** `read_at: null → <instant>`, set by `markNotificationRead` (one row) or
`markAllNotificationsRead` (every unread row the caller holds). Both statements carry
`AND read_at IS NULL`, which is what makes FR-027's idempotence and FR-030's "leaves already-read rows
untouched" properties of the `WHERE` clause rather than of a check. There is no unread mutator: no
screen and no mutator offers one (*Out of Scope*).

**Delivery state.** `(emailed_at: null, send_attempts: 0)` → at most four attempts → either
`emailed_at` set (terminal, delivered) or `send_attempts = 4` or age past one hour (terminal,
abandoned; the in-app row is unchanged and still readable, FR-067). Both writes carry
`AND emailed_at IS NULL`, so the duplicate send the spec accepts produces one stamp and one increment,
not two.

The two are entirely independent: a row can be read before it is mailed, and an abandoned email leaves
the row's in-app life untouched.

---

## 6. Files touched by the data model

| File | Change |
| --- | --- |
| `src/db/schema.ts` | **EDIT** — one `pgTable` appended (`notification`); nothing else altered |
| `src/db/tables.ts` | **EDIT** — `"notification"` added to `ALL_TABLES` so `truncateAllTablesStatement()` covers it |
| `drizzle/0008_*.sql` | **NEW** — generated by `npm run db:generate`, SQL inspected, committed (FR-009) |
| `drizzle/meta/0008_snapshot.json` | **NEW** — generated, committed with the migration |
| `drizzle/meta/_journal.json` | **EDIT** — generated |

Untouched and named so: every migration `0000`…`0007` · `drizzle.config.ts` (the schema is still one
file) · `src/db/index.ts`, `src/db/touched.ts`, `src/db/unique-violation.ts`, `src/db/test-database.ts`
(it calls `truncateAllTablesStatement()` and needs no edit once `tables.ts` knows the table) ·
`src/features/auth/server/projections.ts` (FR-073).

**The SQL is inspected for three things specifically** before it is committed: that both partial
indexes carry their `WHERE` clause, that the three cascading foreign keys render `ON DELETE cascade`,
and that `send_attempts` renders `integer DEFAULT 0 NOT NULL`.
