# Contract — the change-password link

**Plan**: [`../plan.md`](../plan.md) · **Spec**: [`../spec.md`](../spec.md) · **Research**: [`../research.md`](../research.md)

**This entry delivers the door, not the room.** Every mechanism behind this link — the token, the
mail, the throttle, the policy, the screen it lands on, the session ending — is entry R1's and is
already implemented. What R4 adds is a second way in, one that asks for no address because it already
knows it.

---

## The control

| | |
| --- | --- |
| Where | on the profile screen, one press (`FR-026`, §3.12) |
| What it is | a link, not a field. **There is no password input on this screen** (`FR-027`) |
| What it asks for | nothing. No address is typed and no form is shown (`FR-026`, US4 scenario 3) |
| On success | the message "Check your email for a link to reset your password." (`FR-029`, verbatim) |
| On refusal by the throttle | the request is refused and the message states the time remaining, in whole minutes rounded up and never below one: "Too many requests. Try again in 3 minutes." (`FR-028`) |
| While in flight | the link shows that state on itself and cannot be pressed a second time. The state is conveyed programmatically as well as visually — React Aria's own pending semantics, never colour or motion alone — and renders on the link, never as a separate or full-screen indicator. This write waits for the server: it has nothing on screen to apply optimistically (`FR-026`) |
| Scope of that lock | exactly the in-flight request. It releases when the request settles, so two presses made in succession are two requests and two valid links; `FR-028`'s rate limit, not this lock, is what bounds them (`FR-026`, spec edge case) |
| Confirmation step | none. One press sends. §3.12 says one click sends a link and shows no form; a second "are you sure" would contradict it, and the act is reversible by ignoring the mail |

---

## The action

`requestOwnPasswordReset()` in `src/features/auth/actions.ts` — the module that already owns
`requestPasswordReset` and `completePasswordReset`. It lives in `auth` because `auth` owns the reset
mechanism; the profile feature owns the link.

```text
requestOwnPasswordReset()
  → { status: "sent" }
  | { status: "throttled", retryAfterSeconds: number }
```

| # | Step | Rule |
| --- | --- | --- |
| 1 | `assertSameOrigin()` | R1's convention, named in the spec's *Inherited constraints* |
| 2 | `requireActor()` | `FR-019` — the subject is the session's, never the browser's |
| 3 | Read that user's own email by id | `FR-026` — the address is never typed and never sent |
| 4 | `assertNotThrottled({ flow: "reset", email, ip })` | `FR-028`, `OT-SEC-017` |
| 5 | `recordFailure({ flow: "reset", email, ip })` — every press, refused or not | `OT-SEC-017`: "a reset request MUST record a row every time" |
| 6 | `issueResetToken({ userId })` | R1's, unchanged |
| 7 | `sendPasswordResetMail({ to, token })` | R1's, unchanged — the link is `/reset?token=…` |

**`flow: "reset"`, never `"signin"`.** R1's `auth_attempt` table discriminates by flow, so this
press is counted in the reset bucket. Two consequences `FR-028` requires and US4 scenarios 8 and 10
assert: an address locked out of sign-in can still press this link, and a refused press cannot block
a sign-in.

**Five presses inside the window, then a refusal.** R1's limit is five per address and twenty per IP
address over fifteen minutes. `SC-011` states the observable: six presses give five mails and one
refusal that names the time remaining.

**A press that cannot be mailed** — `SMTP_URL` or `MAIL_FROM` unset, or the host unreachable — is
reported to the user in the same terms as any other failure on this screen, and the detail stays in
the server log through R1's `logMailSendFailure` (spec edge case, `FR-023`).

---

## Why this is a second action rather than a reuse of the first

`requestPasswordReset` takes an address from a `FormData`. Passing the signed-in user's address to it
from the browser is exactly what `FR-026` and `FR-019` rule out — the address would be on the wire as
a value the client could change.

The two are **not** refactored into one, and that is a decision rather than an omission. The
anonymous flow counts the attempt *before* it knows whether the address exists, because `OT-SEC-017`
requires a row every time and §3.1 requires the answer never to reveal whether an account exists; the
authenticated flow already knows. A shared helper spanning both would carry a flag for which one it
was in — an abstraction over a difference, which Principle I forbids and which the spec applies the
same reasoning to for the two entries' write paths ([`../research.md`](../research.md) E-2).

---

## What happens after the press, and who owns it

| Step | Owner | Requirement |
| --- | --- | --- |
| The mailed link opens `/reset?token=…`, outside the shell | R1 | `FR-028`, US4 scenario 4, `OT-UX-001` |
| The destination enforces the password policy — twelve characters, no composition rules, blocklist | **R1** | `OT-SEC-004`, §3.1 |
| A completed change ends every session for that user, including the requesting browser's | R1, `deleteAllSessionsForUser` | `FR-030`, `OT-SEC-012` |
| That browser returns to sign-in on its next action | R1's `requireActor()` — the cookie survives, the session row does not | `FR-030`, US4 scenario 7 |
| A completed change clears `must_change_password` | R1, `completePasswordReset` | US4 scenario 9 |
| Two presses in quick succession give two valid links; the rate limit stops the third and fourth | R1 issues them; R4 asserts it | spec edge case, `FR-026`, `FR-028` |

**Nothing in this table is implemented by R4.** Each row is a property this entry observes and tests
end to end, not a mechanism it builds.

---

## `OT-SEC-004`, and what this entry proves about it

The clarification settled that this feature's obligation under the password policy is **negative and
directional**: it adds no second place a password can be set, and it points at the screen that does
enforce the policy. Exactly two things are provable of it, and the policy itself is neither.

| Proof | Shape |
| --- | --- |
| **No control on this screen accepts a password** | a structural test over this feature's files, in the idiom `src/features/auth/role-surface.test.ts` already uses for `OT-AUTHZ-011` |
| **The link lands on the screen that enforces the policy** | the press produces R1's reset mail, whose link is `/reset?token=…` — screen 13, §3.1 |

**What is deliberately not tested here.** The twelve-character minimum, the absence of composition
rules and the blocklist. Each is established and enforced by R1 at the one screen that sets a
password, and each is already proved at `src/features/auth/server/password-policy.test.ts`. A test of
the policy written here would exercise R1's code and demonstrate nothing about this feature
(`FR-027`). `OT-SEC-019`, which enumerates the credential-setting entry points outside invite
acceptance, does not list Profile — because Profile is not one.
