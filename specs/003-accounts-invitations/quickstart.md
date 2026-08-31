# Phase 1 — Quickstart and validation

**Plan**: [`plan.md`](./plan.md) · **Spec**: [`spec.md`](./spec.md) · **Contracts**: [`contracts/`](./contracts/)

Ten walkthroughs. Each proves one user story or one convention end to end, names the acceptance
scenarios it covers, and states what a pass looks like. No implementation code here — that is
`tasks.md`'s.

---

## Before anything

> **Implementation is blocked on entry R2.** `/settings/accounts` is a route R2 creates and this
> feature fills; there is no `src/app/(app)/`, no shell, no `ScreenHeader` and no `forbidden.tsx` in
> the tree today. Walkthroughs 1–8 below assume R2 has landed. Walkthroughs 9 and 10, and every
> server-side test, run without it.

### Environment

No new variable. This feature reuses what entry R1 already requires
([`../001-identity-sessions-signin/contracts/environment.md`](../001-identity-sessions-signin/contracts/environment.md)):

| Variable | Why this feature needs it |
| --- | --- |
| `DATABASE_URL`, `APP_URL` | as R1 — `APP_URL` also builds the invitation link |
| `SMTP_URL`, `MAIL_FROM` | the invitation mail. **Unset is a supported state**: the invitation is created and the admin is told it was not sent (`FR-017`) |
| `TEST_DATABASE_URL` | the persistence suite. A separate database, never development or production |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | first-run seeding, so there is one admin to sign in as |

### Setup

```bash
npm run db:generate
```

```bash
npm run db:migrate
```

```bash
npm run dev
```

The full gate, which CI runs and nothing else:

```bash
npm run verify
```

---

## 1 · An admin invites someone · US1

**Covers** US1 scenarios 1, 2, 6, 10, 12.

1. Sign in as the seeded admin and open `/settings/accounts`. The **Invitations** tab is selected.
2. With no invitations outstanding, the panel reads exactly `No outstanding invitations` — one line,
   no illustration.
3. Press **Invite**. Type `not-an-address` and tab out of the field. An inline error names the
   problem, the submit control **stays enabled**, and nothing is written.
4. Press Escape. The modal closes and the field is discarded.
5. Press **Invite** again, enter a fresh address, submit. The control shows in-flight state, the
   modal closes, a **success** toast appears top-right and dismisses itself after five seconds, and
   the new invitation is at the head of the list carrying its issuer, its sent instant and an expiry
   seven days out.

**Pass**: one `invite` row; `expires_at - created_at` is seven days; a message reached the SMTP
endpoint carrying `/invite/accept?token=…`.

---

## 2 · The form refuses duplicates with the remedy that fits · US1

**Covers** US1 scenarios 3, 4, 5, 15, 16.

1. Open **Invite** and enter the signed-in admin's own address. Blur. The error **names that account**
   and offers a control beside it.
2. Press that control. The modal closes, the field is discarded, the **Accounts** tab becomes
   selected, and that account's row is scrolled into view and briefly marked. **The URL does not
   change and no history entry is added** — press Back and you leave the screen entirely.
3. Re-open **Invite** and enter the same address in different casing. It is recognised as the same
   account (`FR-010`).
4. Enter the address from walkthrough 1, which holds an outstanding invitation. The error says so and
   offers **Resend** rather than a second invitation.
5. Deactivate any non-admin account (walkthrough 6), then enter its address. The error names the
   account as **closed** and offers **Reactivate** as the remedy; the control reaches its row among
   the closed accounts.

**Pass**: no invitation was written in any of the five cases.

---

## 3 · Resend, revoke, and the expired row · US1

**Covers** US1 scenarios 7, 8, 9.

1. Copy the link from walkthrough 1's mail. Press **Resend** on that row. A new link is mailed and
   the expiry restarts from now.
2. Open the **old** link. It renders **"not a link this installation issued"** — the digest was
   replaced, so nothing matches.
3. Press **Revoke** on the row. It leaves the list; opening the new link now renders the same unknown
   state.
4. Seed an invitation with `expires_at` in the past. It stays listed, marked expired, with **Resend**
   still offered.

**Pass**: one `invite` row throughout steps 1–2 — resend rewrites, it does not add.

---

## 4 · Someone accepts and is inside · US2

**Covers** US2 scenarios 1, 2, 3, 4, 5, 6, 7, 8, 11, 12.

1. Invite a fresh address and open its link in a clean browser profile. A full-page screen renders
   **outside the shell** — no sidebar, no header — with the invited address shown as a value, and
   fields for first name, last name and **one** password.
2. Submit an eleven-character password. The field reports **which rule** failed; no account exists.
3. Submit a compliant one. A `user` row is created, a session is written, the cookie is set, and the
   browser lands on `/home` — no second trip through sign-in.
4. Read the new account's role: `member`. Read `must_change_password`: `false`.
5. Open the same link again: **already used**.
6. Open a seeded expired invitation's link: **expired** — a different screen.
7. Open `/invite/accept?token=zzzzzzzzzzzzzzzzzzzzzz`: **unknown** — a third different screen.
8. Back on `/settings/accounts`, the accepted invitation is **no longer listed**, and the new account
   appears on the Accounts tab.
9. Set an accepted invitation's `created_at` a year into the past and open its link: still **used**.
   No age turns it unknown (`FR-031a`).

**Pass**: three visibly distinct dead-link screens, and the `invite` row for step 5 still exists with
`accepted_at` set.

---

## 5 · The roster reads the team · US3

**Covers** US3 scenarios 1, 2, 3, 4, 5.

Seed several accounts, some deactivated. Open the **Accounts** tab.

- Every account is listed, **active first, then closed**, alphabetical by display name inside each
  group.
- Each row shows avatar, display name (first + space + last), email, role, joined date and a project
  count.
- The project count is **`0` for every row, including admins** — `project_member` does not exist
  until R5, and this is the figure the roadmap says to render.
- Each row carries exactly one control, and **no control anywhere sets a role**.

**Pass**: the email column is populated — proof the query used `accountUser` and not `publicUser`.

---

## 6 · Closing an account, and reopening it · US4

**Covers** US4 scenarios 1, 2, 3, 4, 5, 6, 9, 10, 11.

1. Seed two admins and one member. Sign in as the member in a second browser.
2. As an admin, press **Deactivate** on the member. The confirmation is asked **once** and names what
   stays — memberships, assignments, comments and activity.
3. Confirm. In the member's browser, the next request redirects to `/signin`.
4. The member signs in with correct credentials: refused with the **closed-account** message, not the
   generic one.
5. Content the member authored still renders, under their name.
6. Deactivate one of the two admins. On the remaining admin's row, **Deactivate is disabled with the
   reason stated beside it** — visible, not hidden, and not a tooltip.
7. Press **Reactivate** on the member and confirm. They sign in again with the memberships they had.
   No link and no invitation were issued.
8. Read the account afterwards: only its current state is recorded. No activity row was written and
   nobody was notified.

**Pass**: `select count(*) from session where user_id = <member>` is `0` immediately after step 3.

---

## 7 · The server refuses what the client hid · US1, US3, US4

**Covers** US1 scenario 11, US3 scenarios 6, 7, US4 scenarios 7, 12.

1. As a signed-in **member**, open `/settings/accounts`: the Forbidden screen renders **inside the
   shell**, at that URL.
2. Signed out entirely, request the same URL: redirected to `/signin`, and Forbidden is never reached.
3. As a member, call `inviteUser`, `resendInvite`, `revokeInvite`, `deactivateUser` and
   `reactivateUser` directly. Each is refused and writes nothing.
4. With exactly one active admin, call `deactivateUser` for that account directly. Refused; nothing
   written.
5. Demote an admin with `npm run admin:grant` mid-session. Their next render disables the controls and
   the server refuses the mutators — and no row they wrote is removed.

**Pass**: no row changed in any of steps 3–5.

---

## 8 · The four conventions · US1, US3, US4

**Covers** US1 scenarios 13, 14, US3 scenario 9, US4 scenario 13.

| Convention | How to see it | Requirement |
| --- | --- | --- |
| **Skeleton** | Throttle the network and load the tab. A skeleton matching the list's own layout stands in, and **nothing moves** when the data arrives | `FR-055` |
| **Re-query** | Navigate away and back. The rows come from a fresh query; nothing renders from a client cache | `FR-056` |
| **Toast** | Complete any write: success, top-right, stacked newest-nearest-the-corner, self-dismissing at five seconds — and a dismiss control on each | `FR-054` |
| **Banner** | Go offline in devtools and submit. One banner reads `Can't reach the server. Reconnecting.`, the write is refused with `Changes need a connection`, and **nothing is queued** — coming back online and submitting again sends exactly one invitation | `FR-057` |
| **Rejected write** | Force a refusal (walkthrough 7 step 4). The control returns to its prior state and an **error** toast names what failed and why | `FR-058` |
| **In-flight** | Every control shows pending state on itself and nothing is applied optimistically | `FR-059` |

**The banner is for transport failure only.** A permission refusal is a *rejected write* and takes the
error toast, not the banner — that distinction is the requirement.

---

## 9 · Concurrency, against real PostgreSQL

No browser. These are the three rules a mock cannot verify, and AGENTS.md requires them run against a
real instance on a separate database.

```bash
npx vitest run src/features/accounts/server
```

| Race | Assertion | Requirement |
| --- | --- | --- |
| Two admins invite one address at once | exactly **one** `invite` row; the loser gets `has_invitation`, not an error | `FR-009a`, US1 s17 |
| One link accepted in two tabs at once | exactly **one** `user` row; the loser gets **used** | `FR-031`, `SC-005` |
| An address gains an account between issue and acceptance | acceptance refused; no second account | `FR-034` |
| The last two admins deactivated at once | at most one succeeds; the installation never has zero active admins | `FR-049`, `SC-008` |
| Revoke racing acceptance | the row is dropped **or** spent, never both | spec *Edge Cases* |

Each issues both writes through `testDb` with `Promise.allSettled` and asserts exactly one fulfils.
The index and the row lock serialise at the database, so no second connection pool is needed.

---

## 10 · Mail is unconfigured

```bash
SMTP_URL= MAIL_FROM= npm run dev
```

Invite an address. The invitation **is created and appears in the list**; the admin is told the mail
did not go, through a **warning** toast; **Resend** is on the row as the remedy. No retry is
scheduled anywhere.

**Pass**: the `invite` row exists. A mail failure is not a rejected write (`FR-017`).

---

## What the suite covers, and what it cannot

| Covered by `npm test` | Not covered — walk it |
| --- | --- |
| Every server module, mutator, predicate and race (9) | Layout shift when a skeleton is replaced (8) |
| Every synchronous component, in jsdom | Toast stacking order and the five-second timer as seen |
| Token state resolution, all four | The scroll and the transient marker on the jumped-to row (2) |
| The migration and both indexes | Mail actually arriving at a real SMTP endpoint |

**No async Server Component is rendered by a test.** Vitest cannot, and this repository has no E2E
runner and cannot add one under Principle IV — which is why every page is a thin wrapper over a
synchronous component taking plain props ([`research.md`](./research.md) D-6).
