# Contract — sign-out, this feature's only write

**Plan**: [`../plan.md`](../plan.md) · **Research**: [`../research.md`](../research.md) C-1…C-3

R1 delivers session deletion and defers the control here by name; §6 requires signing out to exist;
§3 gives it one surface, the user chip. `FR-018` is the whole of it, and it is the only mutating
request in this entry.

---

## The Server Action

```text
signOut(): never returns — redirects to /signin
```

Added to `src/features/auth/actions.ts`, R1's module carrying top-level `"use server"`. Not a route
handler: AGENTS.md reserves that for public APIs, webhooks, callbacks, feeds and sign-in, and names
sign-in as the only mutation that is not a Server Action.

### Order of operations

| # | Step | Requirement |
| --- | --- | --- |
| 1 | `assertSameOrigin()` — a missing `Origin` counts as foreign. A foreign origin deletes no row and leaves the caller signed in | `FR-018`, `OT-SEC-009` |
| 2 | Read the session cookie from the request. Nothing is read from arguments | `FR-018`, `OT-AUTHZ-004` |
| 3 | Delete the one `session` row that cookie's digest resolves to. Zero rows deleted is success | `FR-018` |
| 4 | Clear the cookie | `FR-018` |
| 5 | `redirect('/signin')` | `FR-018`, `SC-013` |

Steps 3 and 4 run whatever step 3 found, so a session already ended elsewhere produces the same
outcome as one that was live — the spec's edge case: "there is nothing left to delete and nothing to
report".

### Boundaries

| | |
| --- | --- |
| Scope | the caller's session only; never the user's other sessions. `FR-018` now states this outright, and the spec's *Reconciliations* records why §6's "deletes the rows … including other devices" is read as a propagation promise rather than a global sign-out | `FR-018`, spec *Reconciliations*, [`../research.md`](../research.md) C-2 |
| Input | none. There is no form field, no identifier and nothing to validate beyond the origin, which is why gate 3 reduces to step 1 here |
| Output | none. It redirects; it returns no result to the client |
| Errors | none are surfaced. A caller with no cookie, an unknown digest or an expired session is redirected exactly like one that was signed in |
| Never in a response or a log | the session token, its digest, or any SQL |

**What R1 owes it.** R1's `sessions.ts` is contracted for issue, refresh and delete-all. The
single-session delete belongs in that module; this feature adds it there if R1's implementation has
not already.

---

## The control

```text
form action={signOut}
└── Button type="submit"        react-aria-components/Button, inside a "use client" module
```

| Rule | Source |
| --- | --- |
| It is the application's only sign-out control | `FR-018`, §6 |
| It sits on the user chip, as a sibling of the chip's link to `/profile` — never nested inside it | §3, [`../research.md`](../research.md) B-5 |
| It is a form submission, so it works before hydration and needs no `onPress` | AGENTS.md, III |
| It carries an accessible name and a visible focus indicator | `FR-031` |
| It renders on every authenticated screen, `/home` included, because the sidebar does | `FR-002`, `SC-013` |

---

## What it is tested against

The one thing in this feature that touches the database, so the one thing that runs against the real
PostgreSQL instance `TEST_DATABASE_URL` names (AGENTS.md; [`../research.md`](../research.md) D-3).

| Test | Asserts |
| --- | --- |
| a live session | the row is gone, the cookie is cleared, the redirect is `/signin` |
| the same call twice | the second succeeds and reports nothing |
| a cookie naming no row | success, cookie cleared, redirect |
| a foreign `Origin`, and a missing one | refused before anything is read or written |
| another live session for the same user | still present afterwards |
| after sign-out | a request carrying the old cookie resolves no actor (`SC-013`) |
