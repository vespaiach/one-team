# Contract — the server boundary

**Plan**: [`../plan.md`](../plan.md) · **Research**: [`../research.md`](../research.md) C · **Data model**: [`../data-model.md`](../data-model.md)

Six Server Actions and one read, all in `src/features/accounts/`. Every one is a public server entry
point (AGENTS.md), so every one validates, authenticates, authorizes the exact resource, and returns
a safe result.

---

## The prelude every action runs

```text
1. assertSameOrigin({ headers: await headers() })        R1's; a cross-origin post is refused first
2. requireActor()                                        redirects to /signin with no session
3. actor.role === "admin"                                re-read from the user row on every request
4. load the subject BY ITS STORED ROW                    never trust a client-supplied shape
5. do the work                                           in a transaction where more than one row moves
6. revalidatePath("/settings/accounts")                  FR-056's rule, applied to writes
```

Steps 2 and 3 are skipped by `acceptInvitation` alone, which is the one action a stranger may call
(`FR-024`). Step 1 is not.

**Why step 3 needs no cache invalidation.** `loadActor()` reads `user.role` on every request and
caches nothing across them (R1, `OT-SEC-008`). An admin demoted from the command line mid-session is
therefore refused by the very next call, which is `FR-062` — and no row is removed, which is the rest
of it.

**Why step 4 is stated separately.** `FR-060`: the subject account or invitation is derived from the
stored row, not from a client-supplied identifier's claims. An action is given an id; it loads the
row and works from what the row says.

---

## The six actions

All live in `src/features/accounts/actions.ts`, which carries top-level `"use server"` and is the
only module the screen's Client Components import server behaviour from.

### `inviteUser(prevState, formData) → InviteState`

| | |
| --- | --- |
| **Predicate** | `isAdmin` — `FR-012` |
| **Input** | `email`, parsed by R1's `parseEmail` (≤200 chars, shape, **lower-cased on the way in**) — `FR-007`, `FR-010` |
| **Refuses** | malformed · address has an account (`FR-008`, `FR-008a`) · address holds an outstanding invitation (`FR-009`) · `23505` on the partial index (`FR-009a`) |
| **Writes** | one `invite` row: 32 random bytes through R1's `issueToken()`, stored as its SHA-256 digest; `expires_at` = now + 7 days — `FR-013`, `FR-014` |
| **Then** | `sendInvitationMail`, whose outcome rides back in the result — `FR-017` |

```text
type InviteState =
  | { status: "idle" }
  | { status: "created"; mailed: boolean }              mailed:false → FR-017's warning toast
  | { status: "malformed" }
  | { status: "has_account"; accountId; displayName; isDeactivated }
  | { status: "has_invitation"; invitationId }
  | { status: "offline" }                               FR-057
```

**The `23505` path is not an error the admin sees.** Losing the race means an invitation for that
address now exists, so the result is `has_invitation` — `FR-009`'s resend offer, not a failure
(`FR-009a`).

**Case folding happens once.** `parseEmail` already lower-cases, and the index is on `lower(email)`,
so `FR-010` holds for both comparisons this action makes without a second normalisation step.

### `resendInvite(invitationId) → ResendState`

| | |
| --- | --- |
| **Predicate** | `isAdmin` — `FR-012` |
| **Writes** | a new digest and `expires_at` = now + 7 days on the **existing row**, `updated_at` through `touched()` — `FR-020` |
| **Effect** | the previously mailed token now matches nothing and resolves to **unknown** |
| **Refuses** | no such row (already accepted or revoked) |

Offered on an expired invitation too (`FR-022`), and on any listed one (`FR-019`).

### `revokeInvite(invitationId) → RevokeState`

| | |
| --- | --- |
| **Predicate** | `isAdmin` — `FR-012` |
| **Writes** | `delete from invite where id = ?` — `FR-021` |
| **Effect** | the token is invalid at once and the row leaves the list; its link renders **unknown** — `FR-032` |

**Revoke racing acceptance.** Both target the same row and PostgreSQL serialises them. Acceptance
first: the delete removes an already-spent row — refused, because the row is loaded and its
`accepted_at` checked before the delete, and the caller is told the invitation was accepted. Revoke
first: acceptance's conditional update matches zero rows and reports **unknown**, which is the state
the spec's edge case names.

### `acceptInvitation(token, prevState, formData) → AcceptState`

The one action with no `isAdmin` and no actor.

| | |
| --- | --- |
| **Predicate** | none — `FR-024`. The token is the credential |
| **Input** | `firstName`, `lastName`, `password`; trimmed and length-bounded per §5's 200 |
| **Validates** | R1's `assertPasswordPolicy` — ≥12 chars, no composition rules, blocklist — **on the server whatever the form allowed** (`FR-027`, `OT-SEC-004`, `OT-SEC-019`) |
| **Writes** | in one transaction: spend the invitation · `user` (`role: "member"`, `must_change_password: false`) · `credential` · `session` — `FR-028`, `FR-029`, `FR-030` |
| **Then** | sets the session cookie, `redirect("/home")` — `FR-028` |

```text
type AcceptState =
  | { status: "idle" }
  | { status: "policy"; failure: PasswordPolicyFailure }
  | { status: "names" }                                 first or last name missing
  | { status: "used" } | { status: "expired" } | { status: "unknown" }        FR-032
  | { status: "taken" }                                 FR-034 — the address acquired an account
```

**Three atomicity claims, and what holds each:**

| Claim | Mechanism | Requirement |
| --- | --- | --- |
| A link cannot be used twice | `update … where accepted_at is null returning *`; zero rows → **used** | `FR-031` |
| One address never yields two accounts | `23505` on `user_email_lower_idx` → **taken** | `FR-034`, `SC-005` |
| A failed session write leaves no orphan account | all four writes in one transaction | `FR-028` |

**It reads no `user` row.** The address on the form comes from `invite.email` (`FR-033`,
`OT-SEC-018`), and the collision above is discovered by the constraint rather than by a lookup.

**The created account has no role control anywhere.** `member` is written literally; no form field,
no parameter and no screen in this feature sets a role (`FR-029`, `OT-AUTHZ-011`).

### `deactivateUser(accountId) → AccountState`

| | |
| --- | --- |
| **Predicate** | `isAdmin` — `FR-043` |
| **Guard** | R1's `withLastAdminGuard(tx, accountId, apply)` — selects active admins `.for("update")` in the same transaction — `FR-049`, invariant 13 |
| **Writes** | `user.deactivated_at = now` · `delete from session where user_id = ?` — `FR-045` |
| **Refuses** | `LastAdminRefusal` → `{ status: "last_admin" }`, and **nothing is written** — `FR-049` |

Removes nothing else (`FR-047`), writes no activity and notifies nobody (`FR-052`), records no prior
state and no acting admin (`FR-053`).

**An admin may close their own account** where they are not the last active one — the count is the
only guard the source states. Their own sessions go with the rest, so their next request redirects to
`/signin`.

### `reactivateUser(accountId) → AccountState`

| | |
| --- | --- |
| **Predicate** | `isAdmin` — `FR-043` |
| **Writes** | `user.deactivated_at = null` — `FR-051` |
| **Issues** | no invitation, no token, no mail |

Memberships are untouched because none are read or written (`FR-051`, `FR-052`).

```text
type AccountState =
  | { status: "idle" } | { status: "done" }
  | { status: "last_admin" }        FR-049, FR-050
  | { status: "forbidden" }         FR-012's member calling directly
  | { status: "offline" }           FR-057
```

---

## The one read that is not a page query

### `checkInviteAddress(email) → AddressCheck`

A Server Function called on the Invite field's blur (`FR-006`). Admin-only, origin-checked, input
parsed by `parseEmail` like any other boundary (`FR-060`). Its shape is in
[`../data-model.md`](../data-model.md) §3.

It exists because `FR-008`, `FR-008a` and `FR-009` need answers the browser cannot hold: the roster is
never shipped to the client (`OT-DATA-005`). It discloses only what §3.9 already prints on the tab
beside it, and only to an admin who may read that tab.

---

## Refusals, and what a caller is told

`FR-063`: responses carry generic messages; database errors, stack traces and configuration stay in
the server log through R1's `log.ts`.

| Situation | Caller gets | Log |
| --- | --- | --- |
| Cross-origin post | `ForbiddenOriginError` — R1's, unchanged | — |
| No session | redirect to `/signin` | — |
| Signed-in member calling any admin mutator | `{ status: "forbidden" }`, nothing written | — |
| Last active admin | `{ status: "last_admin" }`, nothing written | — |
| Constraint violation the flow expects (`23505`) | the domain answer — `has_invitation`, or `taken` | — |
| Anything else | a generic failure, and `FR-058`'s toast naming what failed | `logUnhandledServerError` |

**A rejected write rolls the row back.** `FR-058` and US4 scenario 13: the control returns to the
state it held, and the toast names what failed and why. Nothing is optimistic, so "rolling back"
means the pending state clears without the change having been shown as done ([`../research.md`](../research.md) C-4).
