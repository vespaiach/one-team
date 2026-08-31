# Phase 1 — Data model

**Plan**: [`plan.md`](./plan.md) · **Research**: [`research.md`](./research.md) · **Spec**: [`spec.md`](./spec.md)

**This feature creates no table, no column and no migration.** `src/db/schema.ts` is untouched,
`npm run db:generate` produces nothing, and `drizzle/` gains no file. What follows is the shape of
what the shell *reads* and the shape of what it *hands to a component* — the only two data
boundaries R2 has.

---

## 1. What is read: `Actor`, extended by two fields

R1 defines the actor as "the resolved answer to *who is making this request*", produced fresh on
every request by one query and cached nowhere (`OT-SEC-008`). This feature reads it and adds two
fields to it.

```text
Actor
  id                    the user's identifier
  role                  string                 R1's type, not a union — compared, never widened
  firstName             required, trimmed
  lastName              required, trimmed
  avatarUrl             string | null          ← added by this feature
  mustChangePassword    boolean                ← added by this feature
```

| Field | Read by | Requirement |
| --- | --- | --- |
| `firstName`, `lastName` | the user chip, joined by one space | `FR-017`, `OT-UX-019` |
| `avatarUrl` | the user chip; absent renders the name alone | `FR-017`, spec edge case |
| `role` | the sidebar, to hide Accounts, Labels and the `+`; every admin-only route, to refuse | `FR-011`, `FR-014`, `OT-UX-003`, `OT-AUTHZ-005` |
| `mustChangePassword` | the shell's banner slot | `FR-025`, `FR-026`, §6 |
| `id` | `signOut`, only indirectly — the session is derived from the cookie, not from this | `FR-018` |

**Why the two fields are added rather than fetched separately.** Both columns live on the `user` row
`loadActor()` already joins to the session row in its single query (R1, *one query* guarantee), so
this is two more selected columns and no second round trip. See [`research.md`](./research.md) B-7.

**`role` stays `string`.** R1 declares it that way in `src/features/auth/server/actor.ts`, and the
two fields below are the only reach-back into `Actor` this feature makes — narrowing the type to
`'admin' | 'member'` would be a third, changing a shape R1's own callers already depend on. Every
consumer here compares it (`actor.role !== 'admin'`) and hands components the `isAdmin` boolean §3
fixes, so the union buys nothing this feature needs. The entry that wants it amends R1's contract
deliberately and records it.

**`Actor` is not a `user` row and not a projection.** §5's read boundary is enforced by `publicUser`
and `accountUser` for records *about other people*; the actor is the caller's own record reaching
only the caller, so neither projection applies and neither is widened. No endpoint in this feature
selects from `user` at all.

### Invariants this feature relies on and does not enforce

| | Owner |
| --- | --- |
| An actor exists only for a live, unexpired session belonging to an account that is not deactivated | R1, `loadActor()` |
| `first_name` and `last_name` are required and length-bounded, so the chip always has a name to render | R1, `user` table |
| `avatar_url` is nullable, so the chip must render without one | R1, `user` table |
| `must_change_password` is set only by first-run seeding and cleared by a completed reset or `admin:grant` | R1 |
| At least one admin is always active | R1 / R3, `OT-INV-013` |

---

## 2. What is written: one row deleted, and one refreshed by inheritance

```text
signOut(): deletes the one `session` row whose digest the request's cookie resolves to
```

| | |
| --- | --- |
| Table | `session` (R1's) |
| Rows affected | exactly one, or zero |
| Zero rows | success — the cookie is cleared and the caller is redirected regardless (`FR-018`) |
| Scope | the caller's session only; never the user's other sessions (see [`research.md`](./research.md) C-2) |
| Subject derivation | the request's own cookie; never a client-supplied identifier (`OT-AUTHZ-004`) |
| Origin | `assertSameOrigin()` first, before anything is read or written (`OT-SEC-009`) |
| Cascades | none. `session` is a leaf; §4's "nothing cascades" is unaffected |
| Activity | none. Activity attaches only to a project or an issue (§5, invariant 10) |
| Notification | none |

**One other statement, and it is R1's.** `loadActor()` selects the actor and then updates that
session's `last_seen_at` and `expires_at` for the sliding cookie §6 defines. The shell layout calls it
on every authenticated render, so an authenticated render both reads and writes — but the write is
R1's, unchanged and un-extended here. `signOut` is the only write this feature *originates*, and the
only one whose behaviour it specifies.

---

## 3. What is handed to a component

The shell's async files read the actor and hand plain values down; every component below is
synchronous and knows nothing about sessions, requests or the database. This is what makes the
requirements testable under change gate 1 ([`research.md`](./research.md) D-1), so these shapes are a
contract, not an implementation detail.

```text
AppShell
  displayName          string          first + " " + last
  avatarUrl            string | null
  isAdmin              boolean         the only predicate the shell can evaluate in this entry
  showPasswordBanner   boolean
  children             the page

ScreenHeader
  name                 string          the title block's first line
  context              node | null     the optional second line
  control              node | null     the one per-screen control slot
  newIssue             node | null     the New issue slot, pinned to the far inline end
```

**`isAdmin`, not `role`.** The sidebar's decision is a predicate, and §2 defines the product's
authorization in terms of predicates rather than role strings. Handing the component a boolean keeps
the role comparison in one place — the same place the routes compare it — and makes the two sidebar
tests read as the two cases they are.

**`context`, `control` and `newIssue` have no occupant in this feature.** Their contract is `FR-007`
and `FR-008`; the behaviour this feature implements and tests is what the header renders when they
are absent (US1 scenarios 5 and 6). Recorded in the plan's Complexity Tracking.

**No shape is invented for what this feature does not render.** The project-list region takes no
projects and the Notifications entry takes no count: R5 and R11 own those, and defining their shapes
here would be a guess at a second caller's needs (I).

---

## 4. Entities named by the spec that this feature does not model

| Entity | Owner | What this feature does |
| --- | --- | --- |
| **Project-list entry** — name, colour, status | R5, with the ordering `OT-UX-020` fixes | renders the region and its one quiet empty line, and reads nothing |
| **Unread count** | R11, with the `notification` table | renders the Notifications entry with no count |
| **Project membership** | R5, `project_member` | cannot evaluate `isMember`; every route whose Access column says *member* gets the signed-in guard, and the membership half lands with R5 |
| **`user` contact fields** | R3 and R4, through `accountUser` | never read; the shell reads the actor and nothing else |
