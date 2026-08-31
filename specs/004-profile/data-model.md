# Phase 1 — Data model

**Plan**: [`plan.md`](./plan.md) · **Research**: [`research.md`](./research.md) · **Spec**: [`spec.md`](./spec.md)

**This feature creates no table, no column and no migration.** `FR-037` states it as a requirement
rather than an outcome: entry R1 created every column this screen reads or writes, with its bounds
and its two projections. `src/db/schema.ts` is untouched, `npm run db:generate` produces nothing, and
`drizzle/` gains no file. A plan that generated a migration would have left the boundary.

What follows is the shape of what is read, what is written, and what is handed to a component — the
three data boundaries R4 has.

---

## 1. What is read: the `accountUser` projection of one row

R1 defines both projections in `src/features/auth/server/projections.ts`. `accountUser` is
`publicUser` plus the four contact fields, and `OT-DATA-005` names its two callers: the Accounts
roster (R3) and Profile reading its own row. This feature is the second.

```text
select accountUser from user where user.id = actor.id
```

| Column | On the screen | Requirement |
| --- | --- | --- |
| `first_name`, `last_name` | writable; joined by one space wherever a display name renders | `FR-006`, `FR-004`, `OT-UX-019` |
| `avatar_url` | writable | `FR-006`, `FR-010`, `FR-011` |
| `job_title`, `slack_handle`, `phone`, `bio` | writable | `FR-006`, `FR-008`, `FR-009` |
| `email` | shown, never a control | `FR-024`, `OT-UX-010` |
| `role` | shown, never a control | `FR-024`, `FR-025`, `OT-AUTHZ-011` |
| `id` | not rendered; the query's own key | `FR-003` |
| `deactivated_at` | not rendered, and always `null` here — an actor exists only for an account that is not deactivated | R1, `loadActor()` |

**The row is keyed by the actor, not by a parameter.** `requireActor()` resolves the session to a
user id server-side; nothing in this feature reads a user identifier from a route parameter, a search
parameter or a request body, because no such parameter exists (`FR-002`, `FR-019`, `OT-AUTHZ-004`).

**`user.feed_filter` is on the row and is not in the projection.** It belongs to R7 and this screen
offers no control for it — the projection is what keeps that true without a rule to remember.

---

## 2. What is handed to a component: `ProfileRecord`

The page awaits the query and hands a plain object down. No component sees a Drizzle row.

```text
ProfileRecord
  avatarUrl      string | null
  firstName      string          required, trimmed
  lastName       string          required, trimmed
  jobTitle       string | null
  slackHandle    string | null
  phone          string | null
  bio            string | null
  email          string          shown, not editable
  role           string          shown, not editable
```

Nine fields: the seven `FR-006` makes writable and the two `FR-024` shows. `id` and `deactivatedAt`
are dropped at the boundary — the screen has no use for either, and a DTO that carried the id would
invite a component to send it (AGENTS.md: never expose database rows as public API or UI models).

---

## 3. What is written: one column of one row

```text
updateOwnProfile(field, value)
  → { status: "accepted" } | { status: "unchanged" } | { status: "refused", reason }
```

| | |
| --- | --- |
| Table | `user` (R1's) |
| Columns writable | exactly seven — `avatar_url`, `first_name`, `last_name`, `job_title`, `slack_handle`, `phone`, `bio` (`FR-006`, `FR-021`) |
| Columns never written | `role`, `email`, `must_change_password`, `feed_filter`, and every other column on the row (`FR-021`, `FR-025`, `OT-AUTHZ-011`) |
| Rows affected | exactly one, or zero |
| Concurrency | last write wins. No version token and no conflict prompt — the only contender for a row is its own owner in a second tab (`FR-016` makes a matching second save a no-op) |
| Zero rows | the value was already stored — `FR-016`, reported as `unchanged`, and nothing moved including `updated_at` |
| Subject derivation | `requireActor()`, from the session cookie; never a client-supplied identifier (`FR-019`, `OT-AUTHZ-004`) |
| Authorization | self only. Neither `isAdmin` nor `isMember` gates it, and there is no check beyond "this is the caller's own row" (`FR-018`, `OT-AUTHZ-001`) |
| Origin | `assertSameOrigin()` first, before anything is read or written |
| `updated_at` | written explicitly through `touched()`, in the same statement (`FR-022`, `OT-DATA-002`) |
| Cascades | none. The write touches one row of one table |
| Activity | none. Activity attaches only to a project or an issue (`FR-036`, `OT-INV-010`, §5 invariant 10) |
| Notification | none, for anybody, including the actor (`FR-036`, `SC-005`) |

### The statement

One `UPDATE`. The `WHERE` carries both conditions, so the "did anything change" question is answered
by the database rather than by a read taken beforehand ([`research.md`](./research.md) B-5).

```text
update user
   set <column> = <value>, updated_at = now
 where id = <actor id>
   and <column> is distinct from <value>
returning id
```

`IS DISTINCT FROM` rather than `<>` because five of the seven columns are nullable: `<>` is unknown
against `NULL`, which would make every clear and every first set look unchanged and write nothing.

### Values, after the parser

| Field | Empty after trimming | Non-empty | Bound |
| --- | --- | --- | --- |
| `first_name` | **refused** — inline error, nothing written (`FR-007`) | trimmed string | 200 |
| `last_name` | **refused** — inline error, nothing written (`FR-007`) | trimmed string | 200 |
| `avatar_url` | `NULL` — the scheme rule does not run (`FR-012a`) | trimmed string, scheme `http` or `https` (`FR-011`) | 2000 |
| `job_title` | `NULL` (`FR-012a`) | trimmed string, accepted as typed | 200 |
| `slack_handle` | `NULL` (`FR-012a`) | trimmed string, no format rule (`FR-008`) | 200 |
| `phone` | `NULL` (`FR-012a`) | trimmed string, no format rule (`FR-008`) | 200 |
| `bio` | `NULL` (`FR-012a`) | trimmed string, plain text, never parsed as markup (`FR-009`, `OT-DATA-016`) | 10000 |

**Every bound is counted in code points**, the unit `char_length` counts, never in UTF-16 code
units (`FR-020`, [`research.md`](./research.md) C-4). A value that is not text at all is refused
before the trim and never reaches this table.

**No optional field is ever written as an empty string** (`FR-012a`). The five columns are already
nullable, and every row this screen has never touched — the seeded first admin, every invited account
— carries `NULL` there, so "unset" keeps one representation and no later reader, R3's roster
included, has to test for two.

---

## 4. Invariants this feature relies on and does not enforce

| Invariant | Owner |
| --- | --- |
| An actor exists only for a live, unexpired session belonging to an account that is not deactivated | R1, `loadActor()` |
| `first_name` and `last_name` are `NOT NULL`; the five optional columns are nullable | R1, `user` table |
| `char_length` ≤ 200 on names, job title, Slack handle, phone; ≤ 2000 on avatar; ≤ 10000 on bio — counted in characters, which `FR-020` makes the parser's unit too | R1, `CHECK` constraints in `src/db/schema.ts` |
| `role` is one of `admin` or `member`, and no UI sets it | R1 / R3, `OT-AUTHZ-011` |
| `email` is unique, case-insensitively, and is the login credential | R1, `user_email_lower_idx` |
| A completed password reset ends every session for that user | R1, `completePasswordReset` → `deleteAllSessionsForUser` (`OT-SEC-012`) |
| Reset attempts are counted in their own `flow` bucket, separately from sign-in | R1, `auth_attempt` and `assertNotThrottled` (`OT-SEC-017`) |
| At least one admin is always active | R1 / R3, `OT-INV-013` |

The two length rules are the one place this feature deliberately restates an invariant rather than
inheriting it: the `CHECK` is the backstop against any writer, and the parser is the boundary that
turns a too-long value into the inline error `FR-017` requires ([`research.md`](./research.md) C-4).

---

## 5. The second write this feature reaches: a reset token

The change-password link is not a profile write. It runs `requestOwnPasswordReset`, which touches
two of R1's tables and none of this feature's.

| | |
| --- | --- |
| Rows written | one `auth_attempt` row every press, and one `reset_token` row when the press is not refused |
| Flow | `reset` — never `signin`, so a refusal here cannot lock the address out of sign-in (`FR-028`, `OT-SEC-017`) |
| Subject | the caller's own address, read from their own row by session-derived id; never typed and never sent by the browser (`FR-026`, `FR-019`) |
| Refusal | `throttled`, carrying the seconds remaining. The action returns seconds; the screen states whole minutes rounded up (`FR-028`) |
| Mail | `sendPasswordResetMail`, whose link is `/reset?token=…` — R1's, unchanged (`FR-028`, §3.1) |
| Session ending | not here. It happens when the mailed link is used, in R1's `completePasswordReset` (`FR-030`, `OT-SEC-012`) |

---

## 6. Entities the spec names that this feature does not model

| Entity | Owner | What this feature does |
| --- | --- | --- |
| **Activity row** | R7 | writes none, and no later entry reaches back to add one — a profile edit has no project and no issue to attach to (`FR-036`, `OT-INV-010`) |
| **Notification** | R11 | writes none, for anybody (`FR-036`, `SC-005`) |
| **`user.feed_filter`** | R7 | the column is on the row it reads; the projection excludes it and the screen offers no control |
| **Another user's record** | nobody — it does not exist in v1 | no route, no parameter, no query. `SC-004` is proved structurally, not by a permission check |
| **Invitation, project membership, issue** | R3, R5, R6 | untouched. This entry's write is one column of the `user` table |
