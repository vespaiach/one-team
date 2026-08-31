# Contract — the invitation, its link, and the four states

**Plan**: [`../plan.md`](../plan.md) · **Research**: [`../research.md`](../research.md) A-2, A-3, B · **Data model**: [`../data-model.md`](../data-model.md)

What an invitation is worth, for how long, and what a person is told when it is worth nothing.

---

## The link

| Property | Value | Requirement |
| --- | --- | --- |
| Secret | 32 random bytes, base64url, via R1's `issueToken()` | `FR-014`, `OT-SEC-006` |
| Stored as | SHA-256 hex digest, 64 characters — **no two secrets are ever compared** | `FR-014` |
| Lifetime | 7 days from issue or reissue | `FR-013`, `FR-020` |
| Uses | one | `FR-013`, `FR-031` |
| URL | `/invite/accept?token=<secret>` | `FR-024` |
| In a query string | accepted, and bounded rather than assumed: single use, seven days, digest-only storage, **never logged**, never carried into an outgoing reference. R1's reset link has the same shape | `FR-024a` |
| Reachable by | anyone; the fourth and last public route | `FR-024`, `OT-SEC-002` |
| Readable from any endpoint | **never** — the digest is matched, never selected into a DTO | `FR-015`, `OT-DATA-006` |

**Exactly one live link per invitation, at any moment.** Resend replaces the digest on the row rather
than adding one, so issuing a new link is what kills the old ([`../research.md`](../research.md) B-3).

**Exactly one live invitation per address.** The partial unique index, not a check
([`../research.md`](../research.md) A-2).

---

## Resolving a token

```text
resolveInvitationState(token, now) → { state, invitation }

  digest = digestToken(token)                       R1's, unchanged
  row    = select … from invite where token_digest = digest
  state  = classifyToken(
             row && { spentAt: row.acceptedAt, expiresAt: row.expiresAt },
             now,
           )
```

`classifyToken` is the extracted pure function shared with R1's reset tokens
([`../research.md`](../research.md) B-1, F-1). Its ordering is the contract:

```text
no row                    → "unknown"
spentAt !== null          → "used"          used beats expired
expiresAt <= now          → "expired"
otherwise                 → "valid"
```

**Used beats expired, and that ordering is why the function is shared.** A link both spent and past
its seventh day reports **used** on this screen and on Change password alike — §3.1 requires the two
to follow "the same convention", and two copies of this branch is how that stops being true.

### The four states a person can land in

| State | When | Screen | Requirement |
| --- | --- | --- | --- |
| **valid** | row found, unspent, unexpired | the acceptance form | `FR-026` |
| **used** | `accepted_at` set — the row was retained for this | "already used", distinct | `FR-031`, `FR-032` |
| **expired** | past `expires_at`, unspent | "expired", distinct from used | `FR-032` |
| **unknown** | no row at all | "not a link this installation issued" | `FR-032` |

**Three different things collapse into unknown**, and that is deliberate: a token never issued, a
**revoked** invitation whose row was dropped (`FR-021`), and a **superseded** token replaced by a
resend. §3.1 names three states and no fourth, and with no row there is nothing to call revoked.

`SC-004` is the measurable form: a person can tell which of the three happened without asking an
admin — and, under `FR-031a`, at any age of link.

### The token's shape is checked before the database is asked

`/invite/accept` applies the same guard R1's reset page uses:

```text
TOKEN_SHAPE = /^[A-Za-z0-9_-]{20,}$/
```

A string that cannot be a token renders **unknown** without a query (`FR-060` — validate at the
boundary; a route parameter is user-supplied input like any other).

---

## The mail

One message, sent once, never retried.

| | |
| --- | --- |
| Transport | the operator's SMTP, `SMTP_URL` + `MAIL_FROM` — R1's, promoted to `src/lib/mail.ts` ([`../research.md`](../research.md) B-5) |
| Link | `new URL("/invite/accept", APP_URL)` with `token` as its one parameter |
| Carries | the installation, that an administrator issued the invitation, the link, and the instant it runs out — `FR-013a` |
| Never carries | the issuing admin's name, any other account, or anything about the size or composition of the team. It reaches an address that may not belong to the person it was meant for — `FR-013a`, `OT-SEC-018` |
| On failure | the invitation **stands**; the admin is told; Resend is the remedy — `FR-017` |
| Retry | none. The in-process timer sweeps `auth_attempt` and is not extended | spec *Out of Scope* |

**The failure is reported, where the reset's is swallowed.** `sendMail` returns `"sent" | "not_sent"`
and never throws. `sendPasswordResetMail` ignores it and logs, because `OT-SEC-011` forbids the reset
flow from varying its answer with whether an address exists. `sendInvitationMail` returns it, because
`FR-017`'s caller is the admin and there is nothing to conceal from them
([`../research.md`](../research.md) B-6).

**A failed send does not roll back the write.** The row is committed before the mail is attempted, so
`{ status: "created", mailed: false }` is a success carrying a warning, not a rejected write — which
is why it raises a **warning** toast and not `FR-058`'s error one.

---

## Acceptance, end to end

```text
GET /invite/accept?token=…
  ├─ shape check                                     → unknown, no query
  ├─ resolveInvitationState                          → used | expired | unknown → its own screen
  └─ valid → render the form
        email      from invite.email, shown as a value, not a control        FR-026, FR-033
        firstName  required, trimmed
        lastName   required, trimmed
        password   one field, not two                            §3.1, spec assumption

POST (Server Action)
  ├─ assertSameOrigin                                                        AGENTS.md
  ├─ assertPasswordPolicy on the server, whatever the form allowed           FR-027
  └─ transaction
       1. update invite set accepted_at = now where id = ? and accepted_at is null
             returning *          ── zero rows → "used"                      FR-031
       2. insert user   role = 'member', must_change_password = false        FR-029, FR-030
             23505 on user_email_lower_idx → "taken"                         FR-034
       3. insert credential  Argon2id via R1's hashPassword                  §6
       4. insert session     R1's issueSession(tx)                           FR-028
     commit
  ├─ cookies().set(SESSION_COOKIE_NAME, token, SESSION_COOKIE_OPTIONS)       FR-028
  └─ redirect("/home")                                                       FR-028, §3.2
```

**No `user` row is read at any point** (`FR-033`, `OT-SEC-018`). The collision in step 2 is discovered
by the index, which is also what makes it correct under two concurrent acceptances.

**The account is not flagged to change its password.** `must_change_password` is set only on the
seeded first admin (`FR-030`, §5, §6).

**The invitation leaves the list the moment it is spent**, because `FR-018` lists only rows with
`accepted_at is null` — no second write and no cleanup step (US2 scenario 11).

---

## What this contract deliberately does not contain

| Absent | Why |
| --- | --- |
| A `revoked` state | Revoke drops the row; §3.1 names three states | 
| A retention horizon | `FR-031a` — indefinite, or `SC-004` becomes conditional on a link's age |
| A mail retry sweep | spec *Out of Scope*; an invitation is mailed once and resent by hand |
| A throttle on `inviteUser` | §6 throttles sign-in and reset. The source states no third, and inventing one would widen scope |
| An erasure path for a spent row | `FR-031b` — it retains no more than the account it created already holds, and no account is erased either (`OT-INV-017`) |
| Bulk invitation, address lists, import | spec *Out of Scope* — the form takes one address |
| Any project grant | `FR-016`, `OT-SCOPE-005` — an invitation grants a login and never membership |
