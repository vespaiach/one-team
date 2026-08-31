# Contract — `createIssue`, `updateIssue`, `deleteIssue`

**Plan**: [`../plan.md`](../plan.md) · **Spec**: [`../spec.md`](../spec.md) · **Research**:
[`../research.md`](../research.md) group B

Three Server Actions, exported from `src/features/issues/actions.ts` under one top-level
`"use server"`. Each is a thin entry point over `src/features/issues/server/`. Each is a public
server entry point whatever its signature, so each validates, authenticates and authorizes the exact
resource before it writes (Principle II, `FR-019`).

Four later entries edit these three functions. What each of them attaches to is named at the end.

---

## Shared rules

**Order of checks, in every mutator.** Resolve the stored row → derive its project from that row →
run the predicate → validate the payload → write. Authorization before validation, so a caller who
may not write learns nothing from the shape of an error. The project is never taken from an argument
(`OT-AUTHZ-004`, `FR-019`).

**Result shape.** A discriminated union, never a thrown error for an expected failure
([`../research.md`](../research.md) B-9):

```
{ status: 'ok', … }
{ status: 'forbidden', reason: string }        the sentence naming the project
{ status: 'not-found' }
{ status: 'invalid', field: string, reason: InvalidReason }
```

`InvalidReason` is a closed set — `'required' | 'too-long' | 'not-a-member-of-this-project' |
'unknown-value' | 'malformed'` — carrying no SQL, no stack and no configuration
(`AGENTS.md` → server boundary).

**Validation.** `src/features/issues/server/input.ts`, one parser per field in R1's `parseEmail`
idiom: takes `unknown`, returns the narrowed value or `null`, never coerces, never truncates.

| Parser | Accepts | Refuses |
| --- | --- | --- |
| `parseTitle` | a string, trimmed, 1–200 characters | empty, whitespace-only, > 200 (`FR-030`, `FR-037`, `FR-049`) |
| `parseDescription` | a string ≤ 10 000 characters, or empty | > 10 000 (`FR-031`, `FR-037`, `FR-049`) |
| `parsePriority` | one of the five values | anything else (`FR-004`) |
| `parseDueDate` | `YYYY-MM-DD` naming a real calendar day | any other shape, an impossible day (`FR-006`) |
| `parseId` / `parseOptionalId` | a UUID | anything else |

Over-length is refused, never capped: `FR-037` and `SC-016` require the server to reject it
independently of whatever the client checked, and Principle II forbids silent truncation. The `CHECK`
constraints are the second line, not the first.

**Revalidation.** Each action revalidates the route it changed before returning
([`../research.md`](../research.md) B-10).

---

## `createIssue`

**Signature** — a form action, called through `useActionState` (`FR-037`, `FR-038`):

```
createIssue(prevState: CreateIssueState, formData: FormData): Promise<CreateIssueState>
```

Fields read from the form: `projectId`, `title`, `description`, `columnId`, `priority`,
`assigneeId`, `dueDate`. The project is fixed by the route and is not an editable field on the form
(`FR-036`); it arrives as a hidden value and is re-resolved and re-checked on the server regardless.

**Predicate** — `isMember(actor, project)`. There is no stored issue to derive from, so the project
row itself is resolved server-side from the route's key and the predicate runs against it
([`../research.md`](../research.md) B-3). A non-member reaching the action directly is refused
whether or not the disabled control was bypassed (`FR-029`, US4 scenario 4).

**One transaction**, in this order (`FR-039`, [`../research.md`](../research.md) B-4):

1. read the project's highest `sort_order`;
2. draw the number — `UPDATE issue_counter SET last_number = last_number + 1 … RETURNING last_number`
   (`FR-013`, `OT-DATA-012`);
3. generate `sort_order` as `generateKeyBetween(highest, null)` (`FR-040`, `OT-DATA-018`);
4. insert the issue, with `created_by` = the actor and `created_at` / `updated_at` through `touched()`.

The draw sits late so the counter lock is held across one insert rather than the whole transaction.

**Defaults when a field is absent**: the project's first column by board position (`FR-032`),
priority `none` (`FR-033`), no assignee (`FR-034`), no due date (`FR-035`).

**On success** the action redirects to the new issue's detail page (`FR-039`). The write is not
optimistic and no provisional key is ever shown — the number does not exist until the server has it
(`FR-015`, `FR-038`).

**Guarantees**

| Guarantee | Requirement |
| --- | --- |
| Exactly one issue per accepted submission | `FR-039` |
| Two racing creations get distinct numbers, neither refused | `FR-016`, `SC-002` |
| No existing issue's number, column or position changes | `FR-040`, `SC-005` |
| A deleted issue's number is never handed out again | `FR-014`, `SC-003` |
| The project row is never touched | `OT-DATA-012` |

---

## `updateIssue`

**Signature** — a typed Server Function, one call per field
([`../research.md`](../research.md) B-2):

```
updateIssue(input: UpdateIssueInput): Promise<UpdateIssueResult>

UpdateIssueInput = {
  issueId: string
  title?: string
  description?: string
  columnId?: string
  priority?: IssuePriority
  assigneeId?: string | null
  dueDate?: string | null
}
```

**Absent means untouched; `null` means cleared.** A field not present on the input is left alone
(`FR-055`); `null` is accepted only on `assigneeId` and `dueDate`, the two fields `FR-006` makes
optional and independently clearable. `null` on any other field is `invalid`.

**No path exists** that sets `project_id`, `number`, `created_by` or `sort_order` — they are not
fields on the input, so `FR-007`, `FR-055` and `OT-INV-002` hold by the type rather than by a check
that could be forgotten. `sort_order` has exactly one writer in this feature and it is `createIssue`
(`FR-040`); `moveIssue` (R10) is the other, and it is a different function.

**Predicate** — `isMember(actor, issue.project)`, derived from the stored row (`FR-018`, `FR-019`).
Any member may edit any issue in their project; there is no authorship check on an issue
(`FR-020`, §2).

**One transaction**, in this order (`FR-055`, [`../research.md`](../research.md) B-5, B-6):

1. `SELECT … FOR UPDATE` the issue row;
2. run the predicate against its project;
3. validate every named field;
4. compute the delta — which named fields differ from the stored row, and what each differs from;
5. **if the delta is empty, return `ok` having written nothing**, `updated_at` included;
6. otherwise `UPDATE` the changed columns only, with `updated_at` through `touched()`.

The row lock exists so step 4 is correct under concurrency: without it two concurrent saves both
compute "changed from Todo to Done" against the same stale read, which would give R7 two activity
rows for one transition and R11 two notifications for one assignment. It does not change who wins —
the second write still applies and is still not refused, which is `FR-064`'s last-write-wins
requirement unchanged.

**The delta is not returned.** `UpdateIssueResult` is `{ status: 'ok' }` and carries no change list.
Nothing in R6 would read one, and a field shipped for a later entry to consume is dead code under
Principle VI — which is the same refusal the spec's *Out of Scope* records for extension points. The
delta is live code inside the transaction, where it decides step 5 and builds step 6's `SET` list.
R7 and R11 extend the function at the line where it already exists.

**Guarantees**

| Guarantee | Requirement |
| --- | --- |
| One call changes one field and leaves the others byte-identical | `FR-048`, `SC-018` |
| A call whose values all match writes nothing, `updated_at` included | `FR-055`, `SC-018` |
| An issue never changes project, by any route | `FR-007`, `SC-009` |
| A column outside the issue's project is refused by the database, not only by the mutator | `FR-005`, `OT-INV-004` |
| An over-length value is refused, never truncated | `FR-049`, `SC-016` |
| Clearing the assignee or the due date is legal | `FR-006` |
| Every column transition is legal in both directions, with no confirmation | `FR-053`, `OT-OPS-011` |
| A non-member is refused server-side however they arrived | `FR-019`, `SC-007` |

---

## `deleteIssue`

**Signature**:

```
deleteIssue(issueId: string): Promise<DeleteIssueResult>
```

**Predicate** — `isAdmin(actor)`, and only that (`FR-018`, `FR-056`, §2). A member's route to remove
an issue is moving it into a `canceled`-kind column, which is reversible and keeps history — that is
an ordinary `updateIssue` call on `columnId` and needs nothing of its own.

**One transaction** holding one statement — `DELETE FROM issue WHERE id = $1` — after the row is
resolved and the predicate has run (`FR-058`, `OT-DATA-008`). The transaction wrapping a single
statement is not redundant: the response must carry the settled state, and R7's and R11's cascade
work joins this transaction rather than introducing it.

**The cascade is the schema's, not this function's** (`FR-059`). Today nothing references an issue,
so the delete removes the issue alone. Each later entry attaches its arm by declaring its own table's
cascading reference, and this body does not change
([`../data-model.md`](../data-model.md) §5).

**On success** the caller navigates to `/projects/:projectKey/details` — a route R5 delivers, so the
delete never leaves a user on a page that has ceased to exist (`FR-060`).

**Confirmation** is the caller's, in the UI, and it is not optional: `FR-061` requires one
confirmation before writing and no path that destroys an issue without it. The dialog's contract is
in [`screens.md`](./screens.md).

**Guarantees**

| Guarantee | Requirement |
| --- | --- |
| A non-admin is refused, disabled control bypassed or not | `FR-056`, `SC-010`, US5 scenario 4 |
| No caller observes a partially deleted issue | `FR-058`, `SC-011` |
| Nothing that referenced the issue survives it | `FR-059`, `SC-011` |
| The freed number is never reissued | `FR-014`, `SC-003`, US5 scenario 5 |
| There is no soft-delete marker anywhere | `FR-057`, `OT-DATA-007` |

---

## What the four later entries attach to

Stated because the roadmap requires every R5, R6, R7 and R10 child spec to say so (§3), and because
what they attach to is a decision this contract makes rather than one `/speckit-tasks` inherits.

| Entry | Adds | Attaches at |
| --- | --- | --- |
| **R7** activity | a `created` row from `createIssue`; a `field_changed` row per changed field from `updateIssue` | inside each transaction, at the line where the delta already exists (`updateIssue` step 4) — §5 requires the activity row in the same transaction as the change |
| **R8** labels | `addIssueLabel` / `removeIssueLabel` as their own mutators; the `issue_label` cascade arm; a count in the delete confirmation | the arm at the database (`FR-059`); the pickers as new controls, not as changes to these three |
| **R10** ordering | `moveIssue` as a second writer of `column_id`, `assignee_id` and `priority`, and the only writer of `sort_order` that originates from a drop | alongside `updateIssue`, not inside it |
| **R11** notifications | an `assignment` row wherever a write sets `assignee_id` to someone other than the actor; the `notification` cascade arm | `createIssue` after the insert; `updateIssue` at step 4's delta, which is where "changed, and not cleared" is answerable (`OT-OPS-016`); the arm at the database |

No hook registry, event dispatch or callback layer is built for any of them. Principle I extracts at
a second call site, Principle III admits indirection for a requirement present today, and an unused
seam is dead code under Principle VI. `updateIssue`'s transaction and delta and the database cascade
are what make those additions edits rather than rewrites.
