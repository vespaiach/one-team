# Contract — mail delivery and the retry sweep

**Feature**: R11 · **Spec**: [`spec.md`](../spec.md) · **Research**: [`research.md`](../research.md)

One message per notification, sent immediately by the process that caused it, retried at most three
times over the following hour by the timer the installation already runs. **No queue, no worker, no
external scheduler, no second timer, no job table and no delivery log** — the spec forbids each by
name.

`src/lib/mail.ts` is **not edited**. It already returns `"not_sent"` rather than throwing when
`SMTP_URL` or `MAIL_FROM` is missing and when the transport rejects, which is exactly what FR-070
needs.

---

## 1. `src/features/notifications/server/mail.ts`

```ts
export function dispatchNotificationMail(notificationIds: string[]): void;
export async function sendNotificationMail(notificationId: string): Promise<void>;
```

### `dispatchNotificationMail` — the immediate send

**Returns `void`, synchronously.** It starts the sends and attaches a `.catch` that calls
`logUnhandledServerError` from `src/features/auth/server/log.ts`. It is called by the five mutators
**after** `await db.transaction(...)` has resolved, and is never awaited.

| Requirement | How the signature holds it |
| --- | --- |
| Sent only after the causing transaction commits, never inside it | the call site is after `await db.transaction(...)` returns | FR-064 |
| The first attempt is issued by the process serving the request, not the sweep | that call site *is* that process | FR-064 |
| The request never waits on the send | a `void`-returning function **cannot** be awaited usefully — the property is in the type, not in caller discipline | FR-065, SC-013 |
| A slow or dead host cannot fail the write | the write already committed; `sendMail` never throws | FR-065, FR-070 |
| One message per notification, no digest and no batching | one `sendNotificationMail` per id | FR-063 |
| Mail failure reaches the server log only | the `.catch`, plus `logMailSendFailure` inside the send | FR-071 |
| An empty array | does nothing | — |

The `.catch` is mandatory, not decorative: an unhandled rejection can be fatal to the Node process,
and `startSweep` already uses `logUnhandledServerError` for the same reason.

**This works because §7 fixes the deployment**: self-hosted on a single box, one long-lived Node
process, so work started after a response is sent survives. On a platform that freezes the process
after the response this pattern would silently drop sends and the sweep would be the only delivery
path. Recorded because it is this feature's one architectural dependency on the deployment model.

### `sendNotificationMail` — one attempt against one row

1. **Load the facts.** One `SELECT` joining `notification` → `user` (recipient `email`, actor names)
   → `issue` / `project` (key, number, name). If the row is gone (its target was deleted) or already
   carries `emailed_at`, return without sending.
2. **Build the message** ([§2](#2-the-message)).
3. **Send** — `sendMail({ to, subject, text })` from `@/lib/mail`.
4. **Record the outcome** ([§3](#3-recording-an-attempt)).

`user.email` is selected **here and nowhere else** in this feature. It never crosses a response
boundary, which is why `publicUser` and `accountUser` are not widened (FR-073).

---

## 2. The message

**Plain text. No HTML alternative part. No template layer. No templates directory.** FR-069, the
spec's eighth clarification and *Out of Scope* all say so, and `sendMail`'s parameter object is
`{ to, subject, text }` — it has no `html` field to fill.

| Part | Content | Requirement |
| --- | --- | --- |
| `to` | the recipient's own address | FR-069 |
| `from` | `MAIL_FROM`, supplied by `sendMail` unchanged | — |
| `subject` | the actor and what happened, plus the target | FR-069 |
| `text` | the actor, what happened, the issue or project, and the link — the same four facts the row itself carries | FR-069 |

The link is built the way `buildResetLink` in `src/features/auth/server/mail.ts` builds its:
`new URL(path, process.env.APP_URL)`, where `path` is **the same path the row's own deep link opens**
([`data-model.md`](../data-model.md) §4), `#comment-<id>` included where the row carries a comment.

**It carries no query string at all**, so FR-069's "no session, no token and no configuration detail"
is structural. Nothing about the wording is fixed by any source and none is invented beyond the four
facts (spec, *Assumptions*).

---

## 3. Recording an attempt

Two statements, one per outcome, both after the attempt has **returned** (FR-066, the spec's tenth
and eleventh clarifications):

```sql
-- sendMail returned "sent"
UPDATE notification
   SET emailed_at = $now, send_attempts = send_attempts + 1, updated_at = $now
 WHERE id = $id AND emailed_at IS NULL;

-- sendMail returned "not_sent"  → also logMailSendFailure(...)
UPDATE notification
   SET send_attempts = send_attempts + 1, updated_at = $now
 WHERE id = $id AND emailed_at IS NULL;
```

| Property | Mechanism | Requirement |
| --- | --- | --- |
| The stamp and the increment land together on success | one statement | FR-066 |
| A failure increments in a write of its own and leaves `emailed_at` null | the second statement | FR-066 |
| Never incremented before the attempt is made | both run after `await sendMail(...)` | FR-066 |
| The count is atomic under concurrency | `send_attempts = send_attempts + 1` in-database, not read-then-write | `AGENTS.md`, Drizzle guidance |
| A process dying mid-send records neither | nothing is written before the send returns | FR-066, Edge case |
| The message may then go out twice | accepted — the spec prefers a duplicate to a loss | FR-066, *Assumptions* |
| The duplicate cannot produce two stamps or two increments | `AND emailed_at IS NULL` — the second update touches zero rows | FR-067, SC-014 |
| The count never passes 4 | that guard, the sweep's `send_attempts < 4`, and the `CHECK` | FR-067, SC-014 |

`send_attempts` reads **1** once the immediate attempt has returned, whichever way it went (FR-007).

**With no mail host configured**, `sendMail` returns `"not_sent"` without I/O, so each row accrues four
no-op attempts across its hour and is then abandoned; the write succeeded, nothing crashed and the row
keeps its in-app life (FR-070). Treating "unconfigured" as "no attempt" was considered and rejected —
[`research.md`](../research.md) D-1.

---

## 4. `src/features/notifications/server/mail-sweep.ts`

```ts
export async function sweepNotificationMail(now: Date = new Date()): Promise<void>;
```

`now` is a parameter, exactly as `sweep(now)` in `src/features/auth/server/sweep.ts` already is, so
the schedule is assertable by clock instead of by fake timers (FR-067, SC-014).

### Selecting the due rows

```sql
SELECT id FROM notification
 WHERE emailed_at IS NULL
   AND send_attempts < 4
   AND created_at >  $now - interval '1 hour'
   AND created_at <  $now - make_interval(mins => send_attempts * 15)
```

then `sendNotificationMail(id)` for each, sequentially.

The fourth predicate is per-row and cannot be expressed in JavaScript, so it is one localized,
parameterized `sql` fragment in this module — `AGENTS.md`'s conditions for raw SQL, each met: one
place, every value bound, `now` a `Date` the caller supplies, and seven clock-driven tests over it.

| Rule | Predicate | Requirement |
| --- | --- | --- |
| Only rows the immediate send left unstamped | `emailed_at IS NULL` | FR-064, FR-067 |
| At most three retries — four attempts in all | `send_attempts < 4` | FR-067, SC-014 |
| Nothing after an hour from creation, whatever the count reads | `created_at > now - 1 hour` | FR-067, Story 5 sc. 6 |
| Due once the age exceeds count × 15 minutes | `created_at < now - count × 15 min` | FR-067, Story 5 sc. 10 |
| A row whose immediate send never returned (`count = 0`) | the interval is zero, so it is due at once — the sweep gives it its first *recorded* attempt, which is what "picks up only rows the immediate send left unstamped" means | FR-064, Edge case |
| Spacing is independent of the timer's period | the predicate reads `created_at` and `send_attempts`; it never reads the tick | FR-068 |
| A tick is an opportunity, never itself a retry | a row that is not due is skipped and its count is untouched | Edge case |
| Retry state survives a restart | it is on the row | FR-007, Edge case |
| An abandoned email leaves the in-app row unchanged | the sweep only ever writes `emailed_at` / `send_attempts` | FR-067 |

---

## 5. Hanging the sweep off R1's timer

**One line added to `sweep()` in `src/features/auth/server/sweep.ts`**, plus its import:

```ts
export async function sweep(now: Date = new Date()): Promise<void> {
  await db.delete(authAttempt)…;      // unchanged
  await db.delete(session)…;          // unchanged
  await db.delete(resetToken)…;       // unchanged
  await sweepNotificationMail(now);   // added
}
```

**Untouched**: `startSweep`, its `SWEEP_INTERVAL_MS` of five minutes, its `timer.unref()`, its
`SIGTERM` handler, its `catch`/`logUnhandledServerError`, and `src/features/auth/server/bootstrap.ts`,
which still calls `(deps.startSweep ?? startSweep)()` with no arguments.

| Requirement | How |
| --- | --- |
| Runs on the one in-process timer the installation already has | `startSweep` takes one callback and `sweep` is it | FR-068, §7 |
| No queue, no worker, no external scheduler | none added | FR-068 |
| No second timer | `setInterval` appears once in the repo's server code, in `startSweep`, unchanged | FR-068, *Out of Scope* |
| The timer's period does not set the spacing | §4's predicate | FR-068 |
| A throwing sweep does not stop the timer | `startSweep`'s existing `catch` | R1 |

**The trade, recorded rather than hidden**: `src/features/auth/server/sweep.ts` now imports
`src/features/notifications/server/mail-sweep.ts`, so an auth module depends on a notifications
module. The alternative — composing the two sweeps inside `bootstrap.ts` — keeps that import
direction clean but moves the composed behaviour into an anonymous callback reachable in a test only
through `bootstrap`, which asserts `APP_URL`, probes the database and seeds an admin first. Trading a
testable seam for an import direction is the wrong side of Principle VII. Carried into the plan's
Complexity Tracking.

---

## 6. What this feature does **not** add

Named so no task claims them, each forbidden by the spec's *Out of Scope* or by a requirement:

digests · batching · any opt-out, preference, mute or per-project subscription · an HTML body · a
template layer or any mail styling · a second interval timer · a job or queue table · a delivery log ·
a retry beyond the fourth attempt or beyond the hour · an unsubscribe link · any header, token,
session or configuration detail in a message · exactly-once delivery (a duplicate is preferred to a
loss) · mail to a deactivated recipient computed into a set (they are excluded when the set is
computed; a recipient deactivated *after* the row was written still receives it) · any client-facing
message about a mail failure — the log only, and any client-facing text stays generic (FR-071).
