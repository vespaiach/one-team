# Contract — `createComment`, `updateComment`, `deleteComment`, `setFeedFilter`, and the writer

**Plan**: [`../plan.md`](../plan.md) · **Spec**: [`../spec.md`](../spec.md) · **Research**:
[`../research.md`](../research.md) groups B, C, D

Four Server Actions, exported from `src/features/activity/actions.ts` under one top-level
`"use server"`, plus the internal function three of them and seven inherited mutators call through.
Each action is a public server entry point whatever its signature, so each validates, authenticates
and authorizes the exact resource before it writes (Principle II).

---

## `writeActivity` — not exported from `actions.ts`, not a mutator in its own right

```ts
type ActivityTarget = { issueId: string } | { projectId: string };

async function writeActivity(
  tx: Transaction,
  input: {
    type: "created" | "field_changed" | "member_added" | "member_removed" | "archived" | "reopened" | "comment";
    target: ActivityTarget;
    actorId: string;
    field?: string;
    fromValue?: string | null;
    toValue?: string | null;
    commentId?: string;
  },
): Promise<void>
```

Lives at `src/features/activity/server/write-activity.ts` (research B-1). Opens no transaction,
authorizes nothing, computes no diff (`FR-013`) — its whole body is one `INSERT`. Every caller listed
below supplies `tx` already open, has already run its own predicate, and has already decided what
changed. It is imported directly by `src/features/projects/server/*.ts` and
`src/features/issues/server/*.ts`, the same cross-feature shape R1's `publicUser` and `requireActor`
already take.

**Callers**, all inside this contract or the mutators below: `createComment` (§ below);
`createProject`, `updateProject`, `setProjectStatus`, `addProjectMember`, `removeProjectMember`
(`contracts/mutators.md` reach-back, [`../../005-projects-membership-lifecycle/`](../../005-projects-membership-lifecycle/));
`createIssue`, `updateIssue`
([`../../006-issues-creation-detail-editing/`](../../006-issues-creation-detail-editing/)).

---

## The shape every entry point in this feature has

```text
1  assertSameOrigin({ headers: await headers() })      R1's check, first statement, always
2  const actor = await requireActor()                  redirects to /signin when absent
3  validate the argument                               shape, then value  (II)
4  resolve the row the predicate needs                  a stored comment, or nothing at all
5  run the predicate                                    authorship, or "signed in" alone
6  write, inside one transaction where more than one statement is involved
7  refresh()
8  return a typed result — never a row, never SQL, never a constraint name
```

Unlike R5's and R6's mutators, **no entry point in this feature runs `isMember` or `isAdmin` as its
own predicate against a project it looked up itself** — `createComment` is the one exception, and it
derives that project from a stored row rather than accepting one (research C-2).

**Result shape**, matching R6's discriminated-union pattern:

```text
{ status: 'ok', … }
{ status: 'forbidden', reason: string }
{ status: 'not-found' }
{ status: 'invalid', field: string, reason: InvalidReason }
```

`InvalidReason` — `'required' | 'too-long' | 'not-a-member-of-this-project' | 'malformed'`.

---

## `createComment`

**Signature**:

```ts
createComment(input: { target: { issueId: string } | { projectId: string }; body: string }): Promise<CreateCommentResult>
```

**Predicate**: `isMember` of the project `target` resolves to (`FR-015`). For `{ issueId }`, the
project is read from the stored issue's own `project_id` — never accepted as a second argument
(`OT-AUTHZ-004`, research C-2). For `{ projectId }`, the target is the project itself.

**Validation** (`FR-040`, `FR-041`): `body` trimmed, required after trimming, ≤ 10 000 characters —
refused on the field naming the bound, never truncated, independently of whatever the client checked.

**One transaction** (`FR-045`, research C-4):

```text
BEGIN
  resolve the target's project; run isMember
  validate body
  INSERT INTO comment (author_id, body, issue_id | project_id) VALUES (…) RETURNING id
  writeActivity(tx, { type: 'comment', target, actorId: actor.id, commentId: newComment.id })
COMMIT
```

**On success** the new comment is returned to the caller for the optimistic UI to reconcile against
(`FR-037`); the action does not redirect.

**Guarantees**

| Guarantee | Requirement |
| --- | --- |
| A comment always carries exactly one activity row of type `comment` | `FR-045` |
| A non-member is refused server-side however the composer was reached | `FR-015`, `FR-049` |
| An over-length or empty body is refused, never truncated | `FR-041`, `SC-012` |

---

## `updateComment`

**Signature**:

```ts
updateComment(input: { commentId: string; body: string }): Promise<UpdateCommentResult>
```

**Predicate**: the caller is the comment's own `author_id`, and nothing else (`FR-016`) — not current
membership, not `isAdmin`. Resolved from the stored comment, never from a client-supplied author.

**One statement, no writer call** (`FR-047`, research C-5):

```sql
UPDATE comment SET body = $1, updated_at = now() WHERE id = $2
```

`touched()` supplies `updated_at`. Body validation is `createComment`'s rules unchanged (`FR-041`).

**Guarantees**

| Guarantee | Requirement |
| --- | --- |
| No activity row is ever written by an edit | `FR-047` |
| Authorship, not membership, governs the write | `FR-016`, `FR-017` |
| A whitespace-only edit is refused, the prior text kept | `US3 scenario 8` |

---

## `deleteComment`

**Signature**:

```ts
deleteComment(input: { commentId: string }): Promise<DeleteCommentResult>
```

**Predicate**: the caller is the comment's own `author_id` **or** `isAdmin` (`FR-016`).

**One statement** (`FR-048`):

```sql
DELETE FROM comment WHERE id = $1
```

The comment's own `activity` row of type `comment` is removed by the `ON DELETE CASCADE` on
`activity.comment_id` (data-model §2, research A-4) — not by a second statement here.

**A delete racing another delete of the same comment** resolves to one success and one `not-found`;
the second caller's row is simply gone by the time its `DELETE` runs, and Postgres deletes zero rows
without error, so the mutator checks the row count and returns `not-found` rather than a false `ok`
(spec, *Edge Cases*).

**Guarantees**

| Guarantee | Requirement |
| --- | --- |
| Only the author or an admin can ever remove a comment | `FR-016`, `SC-007` |
| Its own activity row disappears with it, nothing else on the feed changes | `FR-048`, `SC-014` |

---

## `setFeedFilter`

**Signature**:

```ts
setFeedFilter(input: { filter: "comments" | "all" }): Promise<SetFeedFilterResult>
```

**Predicate**: signed in, and nothing else (`FR-034`, research C-6). No project is resolved because
none is involved — the row it writes is the caller's own `user` row.

**One statement**:

```sql
UPDATE "user" SET feed_filter = $1 WHERE id = $2
```

**Guarantees**

| Guarantee | Requirement |
| --- | --- |
| The choice applies to both feeds the next time either opens | `FR-033`, `SC-009` |
| Never exposed as a Profile field | `FR-034` |

---

## What this feature adds inside seven mutators it does not own

Full per-mutator shape in [`../research.md`](../research.md) §D and
[`../data-model.md`](../data-model.md) §5. Stated here because the roadmap requires every entry that
reaches back into inherited work to say what it attaches and where (§3):

| Mutator | Owner | Adds | Where |
| --- | --- | --- | --- |
| `createProject` | R5 | one `created`, N `member_added` | after the existing inserts, same transaction |
| `updateProject` | R5 | one `field_changed` per differing field | new: an unconditional locked read and a diff, generalizing the existing date-only read (research D-2) |
| `setProjectStatus` | R5 | one `archived` **or** `reopened` | after the existing `UPDATE` |
| `addProjectMember` | R5 | one `member_added` | one new `SELECT` for the added user's name, then after the existing `INSERT` |
| `removeProjectMember` | R5 | one `member_removed` | one new `SELECT` for the removed user's name, then after the existing `DELETE` |
| `createIssue` | R6 | one `created` | after the existing insert, same transaction |
| `updateIssue` | R6 | one `field_changed` per differing field | at the line the delta already exists (R6 research B-6) |

Six of the seven are additive at an existing point. `updateProject` is the exception, and
[`../plan.md`](../plan.md)'s Complexity Tracking records why: R5's own contract never computed a diff
before this feature needed one, unlike `updateIssue`, which already did.

`deleteIssue` and `deleteProject` are not in this table — neither function's body changes at all
(`FR-058`); the cascade is the schema's.

---

## What no mutator here does

| | Owner |
| --- | --- |
| Computes a recipient set or sends mail for a comment, a mention or an edited mention | R11 |
| Diffs `updateComment`'s mention set against the body it replaces | R11 |
| Widens `activity.type` beyond the seven values this feature writes | R8, R9 |
| Creates, edits or deletes a project or an issue | R5, R6 |
| Rate-limits any of the four mutators above | nothing — matching R6's own reasoning for its three (spec → *Out of Scope*) |
