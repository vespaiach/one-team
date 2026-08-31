# Contract — the six mutators, and the one read that authorizes

**Plan**: [`../plan.md`](../plan.md) · **Research**: [`../research.md`](../research.md) → C · **Data model**: [`../data-model.md`](../data-model.md) → §7

Every export below lives in `src/features/projects/actions.ts`, which carries top-level `"use server"`
and is the only module a Client Component in this feature imports server behaviour from. Sign-in
stays the only mutation that is a Route Handler (§6).

---

## The shape every entry point has

```text
1  assertSameOrigin({ headers: await headers() })      R1's check, first statement, always
2  const actor = await requireActor()                  redirects to /signin when absent
3  validate the argument                               shape, then value  (II)
4  check isAdmin where the mutator requires it         the actor's own role, no query        FR-014
5  delegate to a module under server/                  the transaction opens there, and inside it:
     5a  resolve the project from the stored row       never a client-supplied id       OT-AUTHZ-004
     5b  check the project-scoped predicate            isMember of that project              FR-014
     5c  write
6  refresh()                                           from next/cache
7  return a typed result                               never a row, never a constraint name
```

**Steps 5a and 5b are inside the transaction, and in that order** (`FR-014`). Inside, because a
membership revoked concurrently must be either seen by the check or ordered after the write and never
land between them — a membership row read before the transaction opens is a read followed by a write,
which AGENTS.md is explicit is not protection. In that order, because a project that does not exist is
`notFound()` rather than `forbidden()`: everyone may read everything, so absence is the only honest
answer (`FR-040`, `OT-UX-004`). The module returns `{ status: "not_found" }` and the entry point calls
`notFound()`; it never decides authorization for a project it did not find.

**Step 4 is outside it, and only `isAdmin` sits there** (`FR-014`). The role is a property of the actor
this request already resolved from the session row — §6 caches no identity, so it is read fresh per
request — not a row the write races with. `updateProject` is therefore the only mutator whose predicate
moves inside the transaction. `setProjectStatus`, `deleteProject`, `addProjectMember` and
`removeProjectMember` check at step 4 and resolve their project at 5a with no 5b of their own;
`createProject` has neither a project to resolve nor a project-scoped predicate, so step 4 is its
whole authorization.

Step 6 is `refresh()`, not `revalidatePath` — nothing here is cached, and what needs updating is the
client router's tree, including the sidebar in the `(app)` layout above every screen
([`../research.md`](../research.md) C-7).

Step 7 returns `{ status: "forbidden" }` rather than throwing: the caller is a live screen that has
to roll a value back and name a reason (`FR-038`). The route-level refusal — a non-admin *reaching*
`/projects/new` — is R2's `forbidden()` interrupt and is a different mechanism (`FR-023`).

---

## `createProject`

**Predicate**: `isAdmin` (`FR-015`, §2).

```text
in    name         string, required, trimmed                       FR-024
      key          string, required, ^[A-Z][A-Z0-9]{0,7}$          FR-002, FR-025
      description  string | null                                    FR-027
      startDate    calendar date | null                             FR-028
      targetDate   calendar date | null                             FR-028
      color        one of the seven palette values, default accent  FR-029
      memberIds    string[]  — may be empty                         FR-030

out   { status: "created", projectKey }
    | { status: "key_taken", holder: { key, name } }
    | { status: "invalid", field, reason }
    | { status: "forbidden" }
```

**One transaction, four statements** (`FR-034`): the project row, the five `board_column` rows, the
`issue_counter` row seeded at `0`, and one `project_member` row per id in `memberIds`.

**Rejections before the write**
- `memberIds` containing a deactivated account, or the acting admin's own id (`FR-030`).
- `targetDate` before `startDate` (`FR-028`) — validated here for the message, and backed by the
  table `CHECK` for the race ([`../research.md`](../research.md) A-6).
- A `key` that fails the pattern, or a `name` that is empty after trimming.

**The key clash is the constraint's decision.** On `23505` against `project_key_unique`, the holder is
re-read by key and returned as `key_taken` with its name. No suffix is applied, ever (`FR-026`,
`OT-UX-012`, `SC-004`). Two concurrent creations of one key resolve exactly this way (`SC-003`).

**On success** the action calls `redirect()` to the new project's board route,
`/projects/:projectKey` (`FR-034`). What answers at that route is R10's; the destination is fixed
here.

**Status and columns are not inputs.** A project is created `active` with the five seeded rows, and
neither appears in the type (`FR-031`).

**No activity row is written.** R7 adds `created` and one `member_added` per member to this same
transaction (`FR-019`, spec → *Out of Scope*).

---

## `updateProject`

**Predicate**: `isMember` of the project it changes (`FR-016`, §2), checked **inside the transaction
that writes**, against the row 5a resolved (`FR-014`). Admins pass without a query
([`../research.md`](../research.md) B-1), so the membership row is read only for a non-admin — and when
it is read, it is read under the same transaction as the update. This is the one mutator here whose
predicate can race with a concurrent `removeProjectMember`, and the only reason step 5b exists.

```text
in    projectId    string                                           resolved to the stored row first
      changes      a partial over exactly five keys:
                     name, description, startDate, targetDate, color

out   { status: "saved" } | { status: "invalid", field, reason } | { status: "forbidden" }
```

**`key` and `status` are not in the type** (`FR-016`, `OT-INV-007`). They are absent at compile time
*and* rejected at runtime as unknown keys, because a Server Action's argument arrives over the wire
and a TypeScript type is not runtime validation (AGENTS.md, II).

**One call per field** is the screen's behaviour (`FR-036`), not a restriction the action imposes: the
partial admits more than one key, and the details screen sends one.

**The date rule reads the stored row.** When `changes` carries one date, the other is read inside the
same transaction and the pair is checked. The table `CHECK` is the enforcement against two concurrent
single-field writes; a `23514` on `project_dates_ordered` maps to the same `invalid` result, so both
paths produce one message on the same field ([`../research.md`](../research.md) A-6).

**`touched()` supplies `updated_at`** (`FR-012`).

---

## `setProjectStatus`

**Predicate**: `isAdmin` (`FR-015`, `FR-041`).

```text
in    projectId, status: "active" | "archived"
out   { status: "saved" } | { status: "forbidden" }
```

**Both directions are legal, with no confirmation and no guardrail** (`FR-042`, `OT-OPS-011`). There
is no third state and no terminal one.

**It touches one row.** No column, no membership, and once they exist, no issue (`FR-043`,
`OT-OPS-010`, `SC-009`). The statement's own shape is the guarantee.

Setting the status to the value it already holds is a legal no-op write, not a refusal: `OT-OPS-011`
admits every transition and the switch is a two-state control the client keeps in sync.

---

## `deleteProject`

**Predicate**: `isAdmin` (`FR-015`, `FR-047`).

```text
in    projectId
out   { status: "deleted" } | { status: "not_archived" } | { status: "forbidden" }
```

```text
BEGIN
  SELECT status FROM project WHERE id = $1 FOR UPDATE
  status <> 'archived'  →  return not_archived, write nothing
  DELETE FROM project WHERE id = $1
COMMIT
redirect() away from the deleted project
```

**The status is read inside the transaction, under a row lock** (`FR-047`, `OT-INV-008`). An admin
archiving while another deletes resolves against the locked row, not against the read that rendered
the screen (US4 scenario 9).

**`not_archived` is returned whether or not the disabled control was bypassed** (`FR-047`, `SC-010`).
The control is an affordance; this is the enforcement.

**One `DELETE`, and the database does the rest.** `board_column`, `project_member` and `issue_counter`
carry `ON DELETE CASCADE`, so `OT-DATA-008`'s "no moment where a row is gone and its dependents are
not" is a property of the transaction rather than a promise the mutator makes (`FR-050`, `FR-051`,
`SC-011`).

**The key is free the moment it commits** (`FR-049`, `SC-012`). Nothing is retained.

**The confirmation is the caller's**, not this action's. `deleteProject` refuses an unconfirmed call
no differently from a confirmed one — the confirmation is a UI obligation (`FR-048`) and the archived
check is the server one.

---

## `addProjectMember`

**Predicate**: `isAdmin` (`FR-015`, `FR-045`).

```text
in    projectId, userId
out   { status: "saved" } | { status: "forbidden" }
```

**One insert.** The pair is the primary key, so a duplicate is impossible rather than guarded against
([`../data-model.md`](../data-model.md) §2). A repeat add is a conflict the database refuses; the
picker does not offer it in the first place (`FR-045`).

**A deactivated account is refused.** The picker excludes them (`FR-045`); the action checks
`deactivated_at IS NULL` because the picker is not the enforcement (`OT-AUTHZ-004`).

**Write access arrives on the member's next request** — no acceptance step, no re-authentication, no
waiting period (`FR-046`, `SC-007`). Nothing caches membership, so this needs no invalidation
([`../research.md`](../research.md) C-8).

**There is no invitation and nothing pending.** `addProjectMember` is the whole grant; a person with
no account is invited to the team first, which is R3's (`FR-045`, `OT-SCOPE-005`).

---

## `removeProjectMember`

**Predicate**: `isAdmin` (`FR-015`).

```text
in    projectId, userId
out   { status: "saved" } | { status: "forbidden" }
```

**One delete, and nothing else** (`FR-019`, `OT-AUTHZ-013`, `SC-008`). Assignments, comments and
activity rows live in tables this statement does not name, so their survival is structural.

**Removing the last remaining roster row succeeds**, with no guardrail and no confirmation: every
admin may write in the project whatever the roster holds, so an empty roster locks nobody out
(`FR-045`, US3 scenario 9).

**Removing an admin who was explicitly added removes their row and not their access** — the predicate
admits every admin regardless (US3 scenario 6, spec → *Edge Cases*).

**The revocation is R5's half of `OT-AUTHZ-013`.** The other half — a `member_removed` row in the
project's activity — is R7's, which R7's own roadmap scope names (`FR-019`).

---

## `checkProjectKeyAvailable` — a read, on the mutators' module

**Predicate**: `isAdmin`. It sits on an admin-only screen and answers to the same guard
([`../research.md`](../research.md) D-5).

```text
in    key: string
out   { holder: { key, name } } | { holder: null }
```

Called from the key field as it is typed, **debounced**: the framework dispatches Server Functions
from the client one at a time, so an undebounced check would queue one request per keystroke ahead of
the submit.

**It is an affordance, not the enforcement** (`FR-026`, spec → *Assumptions*). A key that passes here
and is taken before submit is caught by the constraint inside `createProject`, and the inline error
names whoever now holds it. That sequence is normal, not a defect.

---

## What no mutator here does

| | Owner |
| --- | --- |
| Writes an activity row | R7, added to all six in the same transaction as each change |
| Writes a notification, or declares the `notification` arm of the cascade | R11 |
| Creates, renames, recolours, reorders or deletes a column | R9 |
| Creates, closes or reactivates an account | R3 |
| Changes `project.key` | nothing, ever (`OT-INV-007`, `FR-037`) |
