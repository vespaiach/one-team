# Contract — `updateOwnProfile`

**Plan**: [`../plan.md`](../plan.md) · **Spec**: [`../spec.md`](../spec.md) · **Data model**: [`../data-model.md`](../data-model.md)

One Server Action, one field, one row, one column. This is the whole write surface of entry R4.

---

## Signature

```text
updateOwnProfile(field: ProfileField, value: unknown)
  → { status: "accepted" }
  | { status: "unchanged" }
  | { status: "refused", reason: RefusalReason }
```

| | |
| --- | --- |
| Module | `src/features/profile/actions.ts`, top-level `"use server"` |
| `ProfileField` | `"avatarUrl" \| "firstName" \| "lastName" \| "jobTitle" \| "slackHandle" \| "phone" \| "bio"` — exactly seven (`FR-006`, `FR-021`) |
| `value` | `unknown` at the boundary. It arrives from a browser and is parsed, never trusted (Principle II) |
| Return | a typed result. **Never a thrown error for an expected failure** ([`../research.md`](../research.md) B-2) |

**Why one action and not seven, and not a patch object.** `FR-013` fixes "one mutator call per
field" and §3.12 names the single mutator. A patch object would let one call carry two fields, which
US1 scenario 5 asserts never happens, and would turn `FR-021`'s closed set of seven into a runtime
check over an open shape.

**Why it returns rather than throws.** A Server Function that throws inside a `useTransition` is
forwarded to the nearest error boundary with no `try`/`catch`
(`01-app/02-guides/interactive-apps.md`). A refused avatar scheme is an inline error on a field
(`FR-011`, `FR-017`); routing it to an error boundary would replace the screen with a fallback.

---

## The order of operations

Every step is required by a named rule, and the order is part of the contract.

| # | Step | Rule |
| --- | --- | --- |
| 1 | `assertSameOrigin()` on the request headers, before anything is read or written | R1's convention, named in the spec's *Inherited constraints* |
| 2 | `requireActor()` — the caller's own row is resolved from the session cookie; no resolvable session redirects to `/signin` and writes nothing | `FR-019`, `FR-005`, `OT-AUTHZ-004` |
| 3 | Reject a `field` outside the seven | `FR-021` |
| 3a | Reject a `value` that is not a string, `undefined` included, before the trim | `FR-020` |
| 4 | Trim the value | `FR-012` |
| 5 | Apply the field's rule to the trimmed value — presence, the scheme, the bound in code points | `FR-007`, `FR-011`, `FR-020` |
| 6 | Map an empty optional value to `NULL` | `FR-012a` |
| 7 | One `UPDATE`, whose `WHERE` pins the actor's id and requires the column to differ | `FR-016`, `FR-018` |
| 8 | `updated_at` moves in that same statement, through `touched()` | `FR-022`, `OT-DATA-002` |
| 9 | `revalidatePath("/profile")` on an accepted write only | [`../research.md`](../research.md) B-4 |

**Step 2 is the whole of authorization.** `updateOwnProfile` requires only self: neither `isAdmin`
nor `isMember` gates it, and there is no check beyond "this is the caller's own row" (`FR-018`,
`OT-AUTHZ-001`, §2). There is nothing to authorize *against*, because there is no way to name a row
other than your own — the action takes no user identifier, so US2 scenario 4 is satisfied by the
signature rather than by a check.

**Steps 4 and 6 run before step 5's scheme rule, not after.** An avatar value that is empty after
trimming clears the field and is never measured against `FR-011` — the ordering `FR-012a` fixes, and
the one that stops the avatar being the single field on this screen that cannot be emptied once set.

---

## Refusals

Each is inline on the field that failed, names what failed and why, and stores nothing
(`FR-014`, `FR-017`, `FR-023`).

| Reason | Raised when | Requirement |
| --- | --- | --- |
| `required` | first name or last name is empty after trimming | `FR-007` |
| `too_long` | the trimmed value exceeds that field's bound | `FR-020`, C-4 |
| `avatar_scheme` | a non-empty avatar value is not a well-formed absolute link, or its scheme is not `http` or `https` | `FR-011` |
| `unknown_field` | `field` is not one of the seven | `FR-021` |

**The message the caller sees is generic about the server.** A failure that is not one of the four
above — a lost connection to the database, a constraint the parser did not anticipate, a `value`
that is not text — returns a generic refusal reading **"Something went wrong. Try again."**, and the
underlying detail stays in the server log (`FR-023`). No SQL, stack trace or configuration value
reaches the browser. A non-string `value` needs no inline error of its own: this screen's own controls
cannot produce one, and the check exists for a caller that reaches the action directly.

**`unchanged` is not a refusal.** It is the successful outcome of saving a value that was already
stored: the row is untouched, `updated_at` has not moved, and the field returns to its shown state
with no message (`FR-016`).

---

## Bounds and rules per field

The bounds are the same numbers `src/db/schema.ts` enforces as `CHECK` constraints, **counted in the
same unit** — code points, `[...value].length`, never `.length` (`FR-020`). The duplication
is deliberate: the constraint is the invariant against any writer, the parser is the boundary that
produces an inline error instead of a constraint violation
([`../research.md`](../research.md) C-4).

| Field | Column | Required | Empty → | Bound | Extra rule |
| --- | --- | --- | --- | --- | --- |
| `firstName` | `first_name` | yes | refused | 200 | — |
| `lastName` | `last_name` | yes | refused | 200 | — |
| `avatarUrl` | `avatar_url` | no | `NULL` | 2000 | scheme is `http` or `https`, allowlist not denylist (`FR-011`) |
| `jobTitle` | `job_title` | no | `NULL` | 200 | none — accepted as typed |
| `slackHandle` | `slack_handle` | no | `NULL` | 200 | **no format rule** (`FR-008`) |
| `phone` | `phone` | no | `NULL` | 200 | **no format rule** (`FR-008`) |
| `bio` | `bio` | no | `NULL` | 10000 | plain text; never parsed as markup (`FR-009`, `OT-DATA-016`) |

**Nothing fetches the avatar link.** Reachability, content type and image dimensions are not checked;
a link that stops resolving keeps its stored value (`FR-011`, spec edge case).

---

## What this action must never do

| | Rule |
| --- | --- |
| Write `role`, `email`, `must_change_password` or `feed_filter` | `FR-021`, `FR-025`, `OT-AUTHZ-011` |
| Read a user identifier from its arguments, the URL, or a header | `FR-019`, `OT-AUTHZ-004` |
| Coerce or truncate a value that failed its rule | `FR-020`, Principle II |
| Write an empty string to any of the five optional columns | `FR-012a` |
| Write an activity row | `FR-036`, `OT-INV-010` |
| Write a notification, or send mail | `FR-036`, `SC-005` |
| Return SQL, a stack trace or configuration detail to the caller | `FR-023` |
| Move `updated_at` when no value changed | `FR-016`, `FR-022` |

---

## What proves it

| Claim | Test |
| --- | --- |
| Each of the seven writes its own column and no other | `server` project, real PostgreSQL, one case per field |
| A refused value stores nothing | assert the row before and after |
| An identical value writes nothing — `updated_at` included | compare `updated_at` across the call |
| A value at exactly its bound saves; one character beyond is refused | two cases per bounded field |
| The bound counts code points, not code units | a value of bound-many astral characters saves, and the `CHECK` accepts it |
| A `value` that is not a string is refused before the trim | call the action directly with a number, an object and `undefined` |
| An uppercase `HTTPS://` avatar is accepted | one case beside the refused-scheme cases |
| Clearing an optional field stores `NULL`, not `""` | assert `IS NULL`, not `= ''` |
| An empty avatar clears rather than being refused | the `FR-012a` ordering, asserted directly |
| A non-`http`/`https` scheme is refused before storage, called directly rather than through the screen | `SC-010`'s "whether it arrives from the screen or directly" |
| The write touches the caller's own row when a different user's id is supplied alongside | US2 scenarios 4 and 5 — the action takes no such argument, so the test asserts the signature admits none |

The persistence half runs against the real instance `TEST_DATABASE_URL` names, because the bounds are
`CHECK` constraints and the unchanged-value rule is a `WHERE` clause — neither is observable against a
mock (AGENTS.md, *Testing*).
