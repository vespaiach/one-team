# Phase 1 — Data model

**Plan**: [`plan.md`](./plan.md) · **Research**: [`research.md`](./research.md) A, B · **Spec**: [`spec.md`](./spec.md)

One new table, five reach-back edits that add no column, and four data shapes that cross the server
boundary. Everything else this feature reads already exists.

---

## 1. The one new table

`invite` is the sixteenth of §5's sixteen tables and the only one the specification lists without a
*Key fields* entry. Its shape comes from the spec's *Key Entities* and from R1's conventions, not
from a decision made here ([`research.md`](./research.md) A-1, A-6).

### Drizzle, in `src/db/schema.ts`

```text
export const invite = pgTable(
  "invite",
  {
    id            uuid          primaryKey, $defaultFn(uuidv7)
    email         text          notNull
    invitedBy     uuid          notNull, references(user.id, onDelete: "cascade")
    tokenDigest   text          notNull, unique
    expiresAt     timestamptz   notNull
    acceptedAt    timestamptz   nullable
    createdAt     timestamptz   notNull
    updatedAt     timestamptz   notNull
  },
  (table) => [
    uniqueIndex("invite_email_lower_unspent_idx")
      .on(sql`lower(${table.email})`)
      .where(sql`${table.acceptedAt} is null`),
    check("invite_email_length",        sql`char_length(${table.email}) <= 200`),
    check("invite_token_digest_length", sql`char_length(${table.tokenDigest}) = 64`),
  ],
)
```

### Every column, and what puts it there

| Column | Type | Null | Source |
| --- | --- | --- | --- |
| `id` | `uuid` | no | §5 conventions — UUIDv7, server-generated |
| `email` | `text` ≤ 200 | no | *Key Entities*; the 200 bound is §5's for addresses, matching `user.email` |
| `invited_by` | `uuid` → `user.id` | no | `FR-018` — the list shows who invited them |
| `token_digest` | `text` = 64, unique | no | `FR-014`, `OT-SEC-006` — SHA-256 hex of 32 random bytes |
| `expires_at` | `timestamptz` | no | `FR-013` — seven days |
| `accepted_at` | `timestamptz` | **yes** | `FR-031` — null is unspent; set is spent, and spent is retained |
| `created_at` | `timestamptz` | no | `FR-018` — when it was sent; also the list's sort key |
| `updated_at` | `timestamptz` | no | §5 — written through `touched()` by every mutator that changes the row |

**Why `updated_at` when `reset_token` has none.** A reset token is only ever spent; an invitation is
**rewritten** by resend, which replaces `token_digest` and `expires_at` ([`research.md`](./research.md)
B-3). §5 requires `updated_at` on a row a mutator changes.

**No `revoked_at`.** Revoke deletes the row (`FR-021`), so there is no revoked state to record and no
fourth token state to answer ([`research.md`](./research.md) B-2).

**No `accepted_by`.** The account created by acceptance is found by address, and §3.9 retains no
actor for account state changes (`FR-053`); recording one here would be the audit trail the spec puts
out of scope.

### The two indexes, and the two that are absent

| Index | Kind | Serves | Requirement |
| --- | --- | --- | --- |
| `invite_token_digest_unique` | unique on `token_digest` | acceptance's only lookup | `FR-014`, `FR-032` |
| `invite_email_lower_unspent_idx` | **unique, partial** — `lower(email) WHERE accepted_at IS NULL` | at most one live offer per address, under concurrency | `FR-009a` |

Absent by decision, not oversight ([`research.md`](./research.md) A-5): nothing on `invited_by`
(never filtered; a `user` row is never deleted, so no cascade scan) and nothing on `created_at` (the
list is a full scan of a table bounded by the people ever invited to one installation).

**The partial predicate is load-bearing.** A revoked row is deleted and never participates. An
**expired but unspent** row does participate, which is correct: `FR-018` still lists it and `FR-022`
still offers resend, so it is outstanding and a second invitation for that address is refused with
`FR-009`'s resend offer.

### Migration

One `npm run db:generate` run producing `drizzle/0002_*.sql`, inspected and committed with its
metadata. It creates the table and both indexes and touches no existing table.

`src/db/test-database.ts` gains `"invite"` to `TRUNCATED_TABLES`, placed **before** `"user"` so the
list stays child-first.

---

## 2. Lifecycles

### An invitation

```text
                      inviteUser
                          │
                          ▼
                    ┌───────────┐   resendInvite (new digest, +7d)
                    │  OUTSTANDING │◀─────────────┐
                    │ accepted_at  │──────────────┘
                    │   = null     │
                    └───────────┘
                     │    │     │
   past expires_at   │    │     │  revokeInvite
        (no write)   │    │     │
                     ▼    │     ▼
              ┌──────────┐│  ┌──────────┐
              │ EXPIRED  ││  │ row gone │
              │  listed, ││  │          │
              │  marked, ││  └──────────┘
              │  resend  ││
              └──────────┘│ acceptInvitation
                          ▼
                    ┌───────────┐
                    │   SPENT   │   retained indefinitely, never listed
                    │accepted_at│   FR-031, FR-031a
                    └───────────┘
```

**Expiry is not a state change.** No row is written when an invitation passes its seventh day; the
state is derived by comparing `expires_at` to now, exactly as R1 derives a reset token's. That is why
`FR-022` can keep the row listed and keep offering resend.

**Three terminal readings of a token**, and they are what `FR-032` requires to be distinguishable:

| The row | State reported at `/invite/accept` | Because |
| --- | --- | --- |
| found, `accepted_at` null, `expires_at` in future | **valid** | the form renders |
| found, `accepted_at` set | **used** | `FR-031` retained it |
| found, `accepted_at` null, `expires_at` past | **expired** | derived, not stored |
| **not found** — never issued, revoked, or superseded by a resend | **unknown** | `FR-032`, and B-2, B-3 |

### An account

```text
   acceptInvitation ──▶ ACTIVE ──deactivateUser──▶ CLOSED ──reactivateUser──▶ ACTIVE
   (or first-run seed)   deactivated_at null      deactivated_at set
```

`deactivated_at` is the whole of it. `FR-053`: the current state is the only state recorded — no
history, no acting admin. Deletion is not a transition anywhere in the product (`OT-INV-017`).

**What deactivation writes**, in one transaction under R1's `withLastAdminGuard`:

| Write | Requirement |
| --- | --- |
| `user.deactivated_at = now`, `updated_at` through `touched()` | `FR-045` |
| `delete from session where user_id = ?` — R1's `deleteAllSessionsForUser(id, tx)` | `FR-045`, `OT-SEC-013` |

**What it does not write**: no `activity` row, no `notification`, no project or membership change
(`FR-052`), and nothing removed anywhere (`FR-047`).

---

## 3. What crosses the server boundary

Four shapes. None is a database row: AGENTS.md forbids exposing `$inferSelect` as a UI model, so each
is an explicit DTO built by the query that serves it.

### `InvitationRow` — the Invitations tab

```text
{ id, email, invitedByName, sentAt, expiresAt, isExpired }
```

`invitedByName` is the display name — first and last joined by one space, R2's `FR-017` rule — and it
renders for a deactivated inviter like any other (the spec's edge case). `isExpired` is computed
server-side against one `now`, so every row on a render agrees.

**Never on this shape**: `tokenDigest`. `FR-015` and `OT-DATA-006` put invite secrets out of reach of
every read endpoint, and the way to hold that is for the digest never to be selected into a DTO.

### `AccountRow` — the Accounts tab

```text
{ id, firstName, lastName, displayName, avatarUrl, email, role, joinedAt, isActive, projectCount }
```

Selected through R1's **`accountUser`** projection (`FR-039`, `OT-DATA-005`) — the projection §5's
read boundary reserves for Accounts and for Profile reading its own row. Every other read of a `user`
row in the product uses `publicUser`, and this feature adds no exception.

| Field | Source | Requirement |
| --- | --- | --- |
| `displayName` | `firstName + " " + lastName` | `FR-038`, `OT-UX-019` |
| `email` | `accountUser` only | `FR-039`, `OT-DATA-005` |
| `role` | `user.role`, read per request | `FR-037`, `FR-042` |
| `joinedAt` | `user.created_at` | `FR-041` |
| `isActive` | `deactivated_at is null` | `FR-036` |
| `projectCount` | **literal `0`** until R5 | `FR-040`, `OT-AUTHZ-006` |

**`projectCount` is zero, and the test asserts that zero.** `project_member` does not exist; R5
creates it. The column is rendered, not deferred — the roadmap says the roster "reads `project_member`
rows and reads zero until then", and R5 replaces the expression with a subquery without changing this
screen's contract or its DTO.

### `RosterView` — what the roster query returns alongside its rows

```text
{ rows: AccountRow[], activeAdminCount: number }
```

`activeAdminCount` exists so `FR-050` can disable the sole active admin's control with its reason
inline, computed on the server in the same read as the rows ([`research.md`](./research.md) D-5). The
client uses it to disable; `deactivateUser` re-derives it under a row lock and is the enforcement
(`FR-061`).

### `AddressCheck` — the Invite field's blur answer

```text
| { result: "ok" }
| { result: "malformed" }
| { result: "has_invitation"; invitationId }
| { result: "has_account"; accountId; displayName; isDeactivated }
```

`FR-006` puts validation on blur per field, and `FR-008`/`FR-008a`/`FR-009` need answers the browser
cannot hold — the roster is not shipped to the client (`OT-DATA-005`). `isDeactivated` is what
`FR-008a` renders as the closed-account refusal with Reactivate as its remedy; `accountId` is what the
in-page jump highlights ([`research.md`](./research.md) D-2).

**This is a read endpoint over addresses, so it is admin-only** and validates its input like any other
(`FR-060`). It discloses only what §3.9 already prints on the tab beside it.

---

## 4. Ordering

| List | Order | Source |
| --- | --- | --- |
| Invitations | `created_at` **descending** — newest first | §3.9, "at the top of the list"; spec assumption |
| Accounts | active before closed; **alphabetical by display name** inside each group | §3.9 fixes the grouping; the spec's assumption fixes the order within it |

Both are `ORDER BY` clauses, not client sorts, so a skeleton's row order matches what replaces it
(`FR-055`).

---

## 5. Read boundary — what this feature adds, and what it must not

| Table | Read here | Written here |
| --- | --- | --- |
| `invite` | the list DTO, **never the digest**; the digest is matched, never returned | inserted, updated by resend, updated by acceptance, deleted by revoke |
| `user` | `accountUser` for the roster (`FR-039`); `publicUser` nowhere in this feature | inserted by acceptance; `deactivated_at` by the two account mutators |
| `credential` | never | inserted by acceptance |
| `session` | never | inserted by acceptance; **all rows for a user** deleted by deactivation |
| `auth_attempt` | never | never — no throttle is added; §6 names sign-in and reset only |
| `project_member` | does not exist; `projectCount` is `0` | never |

`/invite/accept` **reads no `user` row at all** (`FR-033`, `OT-SEC-018`). The address it shows comes
from `invite.email`. This is the same rule §3.1 already applies to the deactivated sign-in message,
and it is why acceptance discovers a colliding account through the unique index rather than through a
lookup ([`research.md`](./research.md) A-3).
