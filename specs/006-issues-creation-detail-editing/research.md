# Phase 0 — Outline & research

**Feature**: Issues — creation, detail and editing · **Entry**: R6 · **Date**: 2026-08-31

**Spec**: [`spec.md`](./spec.md) · **Plan**: [`plan.md`](./plan.md)

Forty-one decisions in five groups — nine on the schema, ten on the mutators, nine on the
markdown subset, nine on the screens and four on testability. Each names what was chosen, why, and what was rejected. Nothing
here widens the spec's scope; where a decision settles something the specification left open, it says
so and cites the sentence that left it open.

Twelve questions were already closed across three `/speckit-clarify` sessions and are recorded in the
spec's own *Clarifications*. This file does not re-open them. What it adds is the layer beneath: the
constraints PostgreSQL, Next.js 16, React 19 and `AGENTS.md` impose on satisfying them.

---

## A. Schema, and what the database enforces rather than the code

### A-1. One table, `issue`, in the single schema file

`src/db/schema.ts` is the whole schema and `drizzle.config.ts` points at it directly
(`AGENTS.md` → Architecture notes). This feature appends one `pgTable` and edits one of R5's, and
splitting the file would mean editing that config in the same change for no gain.

Columns, in the order §5's *Key fields* lists them: `id` (UUIDv7, server-generated, `$defaultFn`),
`project_id`, `number`, `title`, `description`, `column_id`, `priority`, `assignee_id`, `due_date`,
`created_by`, `sort_order`, `created_at`, `updated_at`. No `status`, no `parent_id`, no `deleted_at`
— `FR-002`, `FR-003` and `FR-057` are each the *absence* of a column, and the migration is where a
reviewer sees that they hold.

`CHECK` constraints, per §5's conventions and `FR-008`: `char_length(title) <= 200`,
`char_length(description) <= 10000`, `priority in ('none','low','medium','high','urgent')`. The
priority enumeration is `text` + `CHECK`, not `pgEnum`, because §5 fixes that convention and R1
already follows it for `user.role` and `user.feed_filter`.

`src/db/test-database.ts`'s `TRUNCATED_TABLES` gains `"issue"`, ahead of the R5 tables it references.

**Rejected**: a `status` column alongside `column_id`. §5 says the column "replaces the old `status`
enum" and `FR-003` restates it; two sources of the same truth is the drift the invariant exists to
prevent.

### A-2. `UNIQUE (project_id, number)` is the address, and the only index this feature adds

`FR-017` resolves an issue from the pair, `FR-014` forbids reuse, and `SC-002` requires two racing
creations to hold distinct numbers. One unique constraint does all three: it is the lookup index for
`/projects/:projectKey/issues/:issueNumber/details`, its leading column serves "every issue in this
project", and it is the backstop that turns a counter bug into a refused write rather than two issues
sharing `WEB-7`.

`AGENTS.md` says to add indexes for known query patterns only, and PostgreSQL does not index the
referencing side of a foreign key. This feature therefore adds **no** index on `column_id`,
`assignee_id` or `created_by`: no query in R6 filters on any of them. The board's grouping (R10), the
assignee roll-up (R12) and `deleteColumn`'s emptiness check (R9) are where those become known
patterns, and each entry adds the index its own query needs.

**Rejected**: indexing the three foreign keys now because "a foreign key usually wants an index". It
is speculative under the same reasoning Principle I applies to abstractions, and an unused index is
a write cost on every insert.

### A-3. The composite foreign key needs a unique constraint on R5's `board_column`

`OT-INV-004` and `FR-005` require an issue's column to belong to the issue's own project, enforced by
a composite foreign key rather than by a mutator's check. In PostgreSQL a foreign key's referenced
column list must be covered by a unique constraint or unique index. `board_column.id` is the primary
key, but `(project_id, id)` is not automatically constrained even though uniqueness follows from it.

So `board_column` gains `UNIQUE (project_id, id)` — a constraint whose only purpose is to be this
foreign key's target — and `issue` carries:

```
FOREIGN KEY (project_id, column_id) REFERENCES board_column (project_id, id)
```

This is a schema change to a table entry R5 owns. It is recorded in
[`plan.md`](./plan.md)'s *Complexity Tracking* rather than left for a reviewer to discover, and R5's
own plan does not need to anticipate it — R5 has no use for the constraint.

**Rejected**: enforcing the invariant in `createIssue` and `updateIssue` with a lookup. `FR-005` says
"rather than by a mutator's own check alone", and `AGENTS.md` says a read followed by a write is not
protection. Two mutators today, `moveIssue` tomorrow (R10), and the invariant would depend on all
three remembering.

### A-4. That foreign key is `NO ACTION`, and the distinction from `RESTRICT` is load-bearing

Deleting a project cascades to both `board_column` and `issue` (§4). PostgreSQL does not promise an
order among a parent's referencing tables, so the `board_column` rows may be removed while `issue`
rows referencing them still exist inside the same statement.

`ON DELETE RESTRICT` checks immediately and would raise on that intermediate state, breaking
`deleteProject` — an R5 mutator this feature never calls. `ON DELETE NO ACTION` defers its check to
the end of the statement, by which time the project cascade has removed the issues too, and it
passes. `NO ACTION` is Drizzle's default, so the schema states it by omission; the plan states it in
words because a later reader "tightening" it to `restrict` would break a delete two entries away with
no failing test in this feature to catch it.

The behaviour a column delete needs is unaffected: `deleteColumn` (R9) refuses a non-empty column
under `OT-INV-006` before the constraint is ever consulted, and if it did not, the deferred check
would still refuse the delete rather than destroy an issue.

**Rejected**: `ON DELETE CASCADE` on the composite key. Deleting a column would then delete its
issues, which §4's "Renaming, reordering or deleting a column never touches an issue" forbids
outright — and it would put the protection of that rule entirely in a mutator.

### A-5. `project_id` carries its own cascading key; `assignee_id` and `created_by` carry none

The composite key above governs the column pairing, not the project's lifecycle, so `project_id`
additionally references `project(id)` with `ON DELETE CASCADE`. That is the arm of R5's
`deleteProject` cascade that reaches issues, and this feature declares it because this feature owns
the table — the same mechanism `FR-059` fixes for R8's and R11's arms reaching the other way.

`assignee_id` and `created_by` reference `user(id)` with no delete action at all: §4 says a user is
never deleted, `deactivated_at` is the mechanism, and `FR-024` requires an assignment to survive both
removal from the project and deactivation. A cascade or a null-out here would implement the opposite
of the requirement.

### A-6. The number is drawn with one `UPDATE … RETURNING`, not a select-then-update

`OT-DATA-012` requires the number to come from `issue_counter` under a row lock inside the creating
transaction, without touching the project row. A single statement does this:

```sql
UPDATE issue_counter SET last_number = last_number + 1
WHERE project_id = $1 RETURNING last_number
```

An `UPDATE` takes the row lock as part of executing, holds it to commit, and a concurrent draw for
the same project blocks on it and then reads the updated value. Two racing creations therefore
receive distinct numbers and neither is refused, which is `FR-016` and `SC-002` exactly.

**Rejected**: `SELECT … FOR UPDATE` followed by an `UPDATE`. It is two round trips and one more state
to reason about for identical semantics, and Principle III prefers the version a reader follows
without tracing the lock's lifetime.

**Rejected**: a PostgreSQL sequence per project. Sequences are non-transactional — a rolled-back
creation would burn a number — and `FR-014` says a *deleted* issue's number is not returned, not that
a *failed* creation consumes one. A counter row also cascades away with its project, which a sequence
would not.

### A-7. The counter's shape is pinned here, because this feature is its only reader

R5 creates the `issue_counter` row (`FR-008` of R5's spec) and R6 is the only code that ever reads
it; `OT-DATA-012` and §5's *Read boundary* keep it off every read endpoint. R5's spec does not name
its columns and R5 has no plan yet, so this plan pins the contract rather than leaving two entries to
guess at each other:

```
issue_counter(project_id uuid PRIMARY KEY REFERENCES project(id) ON DELETE CASCADE,
              last_number integer NOT NULL DEFAULT 0)
```

`last_number` starting at `0` rather than a `next_number` starting at `1` is what makes A-6's
statement one line with no adjustment in the `RETURNING`: the first issue reads `1`.

This is recorded in [`data-model.md`](./data-model.md) as a dependency R5's plan must satisfy. If
R5's plan chooses different names, this is the one place R6 changes.

### A-8. `due_date` is a `date` read and written as a string, and no instant is ever constructed

§5 fixes `date` for calendar dates and `OT-DATA-004` requires them compared in the server's own
timezone. Drizzle's `date(..., { mode: "string" })` hands the column back as `YYYY-MM-DD` and takes
the same, so the value never passes through a `Date`.

That is the whole of `OT-DATA-004`'s binding on this feature, and `FR-006` says so: R6 stores and
renders a due date and compares none — "due this week" and overdue are R12's and the board's. The
trap the string mode removes is small and real: `new Date("2026-08-31")` parses as midnight UTC and
formatting it back in a server west of Greenwich yields the 30th. Under `mode: "string"` there is no
step at which that conversion could happen.

### A-9. `sort_order` is `text` collated `C`, and `fractional-indexing` is installed here

§5 fixes `sort_order text COLLATE "C"` — the `C` collation so ordering is by byte, which is what
makes a base-62 fractional index sort the way it was generated.

`OT-DATA-018` and `FR-040` require creation to write an index after every existing issue in the same
project, touching no existing row. The append is `generateKeyBetween(highestExistingOrNull, null)`
from `fractional-indexing`, which `AGENTS.md`'s approved-dependency table already lists for exactly
this purpose — so gate 4 is met by the record that already exists and no amendment is needed. The
package is not yet in `package.json`; this feature installs it.

**Rejected**: hand-writing the append and deferring the install to R10. The append is not the easy
half of the scheme — it is the increment-and-lengthen rule that R10's inserts between two keys must
agree with byte for byte. Writing a second implementation of it here to avoid installing an
already-approved package would leave R10 either matching an undocumented convention or migrating
every row.

---

## B. The three mutators

### B-1. All three are Server Actions, and the work sits under `server/`

`AGENTS.md` reserves Route Handlers for public APIs, webhooks, callbacks, feeds and sign-in, and
gives every other mutation in this application to Server Actions. None of these three is a public
API. `src/features/issues/actions.ts` carries the top-level `"use server"` and is the only module a
Client Component imports them from; each action is a thin entry point over
`src/features/issues/server/`, which is where the transaction, the validation and the queries live.

### B-2. `createIssue` is a form action; `updateIssue` and `deleteIssue` take typed arguments

Create issue is a form: `FR-037` wants per-field validation reported back to the fields and `FR-038`
wants in-flight state on the control, which is `useActionState` with a `(prevState, formData)`
signature — R1's idiom in `src/features/auth/actions.ts`, followed unchanged.

The rail's four controls and the two in-place fields are not forms. Each is one value changing, and
`FR-048` and `FR-051` require exactly one `updateIssue` call per field. They call
`updateIssue({ issueId, title: "…" })` with a typed argument, which is what a Server Function
accepts and what keeps the caller from stringifying a date into a `FormData` and parsing it back.

Both are equally untrusted. A Server Function is a public server entry point whatever its signature,
so B-3 applies to both without exception.

### B-3. Every action validates on the server, and derives its project from the stored row

Principle II and `FR-019`. `src/features/issues/server/input.ts` holds one parser per field, in R1's
`parseEmail` idiom — a function taking `unknown` and returning the narrowed value or `null`, never a
coercion. `parseTitle` trims and then requires non-empty and ≤ 200 characters; `parseDescription`
allows empty and requires ≤ 10 000; `parsePriority` matches the five-member set; `parseDueDate`
matches `^\d{4}-\d{2}-\d{2}$` and checks the date is real; `parseOptionalId` and `parseId` match the
UUID shape.

Ordering of checks in each mutator: resolve the stored row, derive its project, run the predicate,
then validate the payload. Authorization before validation means a non-member learns nothing from
the shape of an error message, and deriving the project from the row rather than from an argument is
`OT-AUTHZ-004` — a caller who sends a project they belong to cannot reach an issue in one they do
not.

`createIssue` has no stored issue to derive from, so it resolves the project from the route's key
first and runs `isMember` against that row. The project is still server-derived; it is simply
derived from the project row rather than the issue row.

### B-4. `createIssue` is one transaction: resolve, draw, append, insert

`FR-039` requires one call writing the issue and drawing its number in one transaction. Inside it,
in order: read the project's highest `sort_order`, draw the number (A-6), generate the appended index
(A-9), insert the row. The number draw is last-but-one deliberately — it takes the lock the other
creations queue on, so the lock is held for one insert rather than for the whole transaction's work.

`updated_at` and `created_at` are written explicitly through `touched()` (`FR-008`, §5), never a
trigger and never a database default.

### B-5. `updateIssue` reads its row `FOR UPDATE`, and last-write-wins survives that

`FR-055` requires one transaction per call that reads the stored row and determines, within it, which
named fields differ and what each differs from. Read without a lock and two concurrent saves of the
same field can both compute "changed from Todo to Done", because both read before either wrote —
which would give R7 two activity rows for one transition and R11 two notifications for one
assignment.

`SELECT … FOR UPDATE` on the issue row serializes them. The second still applies and is still not
refused, so the spec's last-write-wins assumption is untouched: the lock changes who computes their
delta against which value, not who wins. The cost is one row lock held for the length of one small
update at a team size under twenty.

**Rejected**: an optimistic-concurrency version column. It would make the second write fail, which
the spec's own assumption forbids — "neither write is rejected and neither client is told it lost".

### B-6. The delta is computed and consumed inside the mutator, and is not returned

This is the sharpest constraint in the feature, and it comes from two requirements pointing opposite
ways. `FR-055` requires `updateIssue` to determine which fields changed and what each changed from.
Principle VI forbids code nothing calls. If the delta were returned in the public result, nothing in
R6 would read it — R7 and R11 do not exist — and it would be dead code shipped as a favour to a
later entry, which the spec's *Out of Scope* bullet already refuses under the name "extension point".

So the delta is live code *inside* the transaction, where it has two present-day consumers:

1. it decides whether to write at all — a call whose named values all match writes nothing,
   `updated_at` included (`FR-055`, `SC-018`);
2. it is the `SET` list — only changed columns are written, which is what makes "a save that names
   one field leaves every other field untouched" true of the SQL rather than of the caller.

`UpdateIssueResult` therefore carries `{ status: "ok" }` and no change list. R7 and R11 extend the
function at the line where the delta is already in hand — the transaction is open, the before-values
are bound, the after-values are bound. That is what the spec means by "an extension rather than a
rewrite", and it needs no seam to be true.

### B-7. A no-op save writes nothing, and `updated_at` is how the test sees it

`SC-018` is verifiable on this feature alone. The persistence test reads `updated_at`, calls
`updateIssue` with the stored title, and asserts the timestamp is byte-identical. Because `touched()`
supplies `updated_at` on every write path, "no write ran" and "the timestamp did not move" are the
same statement, and there is nothing else in R6 that could move it.

The client half stays an assumption, as the spec records: a blur on an untouched field issues no call
at all. The mutator's guarantee is what holds when it does.

### B-8. `deleteIssue` is one statement in one transaction, and the cascade is the schema's

`FR-057`, `FR-058` and `OT-DATA-008`. `DELETE FROM issue WHERE id = $1` inside a transaction, after
`isAdmin` and after the row is resolved. `FR-059`'s "the cascade reaches every row that references
the issue" is a property of the foreign keys other entries declare, not of this function body — which
is exactly why the body does not change as R8 and R11 attach their arms.

One transaction wrapping one statement looks redundant and is not: `OT-DATA-008` requires the
response to carry the settled state, and R7's activity delete and R11's notification delete will join
this transaction rather than introduce it. The same reasoning `FR-055` applies to `updateIssue`.

### B-9. Failures are typed results; only the unexpected throws

`AGENTS.md` — model expected failures as typed results or domain errors, reserve thrown errors for
exceptional failures. Each mutator returns a discriminated union: `ok`, `forbidden`, `not-found`,
`invalid` with the field and the reason. `FR-050` needs the rejection reason to reach a toast that
names what failed and why; a thrown error reaching a Client Component is a digest and a generic
message, which is the opposite.

The `invalid` payload names the field and a reason code, never a SQL message —
`AGENTS.md`'s "return generic messages to clients and keep SQL, stack traces, and configuration in
server logs".

### B-10. Each action revalidates the route it changed

`AGENTS.md` — do not assume a query is cached; revalidate after mutations. `createIssue` redirects to
the new issue, so the destination is fetched fresh. `updateIssue` calls `revalidatePath` on the issue
detail route so a later navigation does not render a stale server payload behind a settled optimistic
value. `deleteIssue` revalidates the project details route it navigates to.

---

## C. The markdown subset, and the extraction `FR-044` requires

Roadmap §1.1 leaves the subset's design to this child spec. `FR-009` fixes what it supports, `FR-010`
the link rule, and `FR-044` the extraction. What follows is the grammar itself.

### C-1. The grammar, closed

Blocks are found line by line; a blank line ends a block.

| Block | Written as |
| --- | --- |
| Heading, levels 1–6 | `#` … `######` followed by one space |
| Bullet item | a line beginning `- ` or `* ` |
| Numbered item | a line beginning with digits, `.`, and one space |
| Paragraph | anything else |

Inline, inside a paragraph, a heading or a list item:

| Inline | Written as |
| --- | --- |
| Bold | `**text**` |
| Italic | `*text*` |
| Inline code | `` `text` `` |
| Link | `[text](url)` |

That is the whole grammar. A fenced code block, a blockquote, a horizontal rule, a table, an image
and an embed are not constructs, so each renders as the characters the author typed — which is
`FR-009`'s "tables, images and embeds MUST NOT be supported" and the spec's own edge case for it.

Leading whitespace before a list marker is not significant: an indented `- ` is an item of the same
flat list. Nested lists are not in the subset, and rendering an indented item as a literal `-` would
be a worse answer to a common keystroke than flattening it.

### C-2. Italic is `*` only; `_` is left alone entirely

`_` is a word character in a bug tracker. `project_id`, `snake_case`, `sort_order`, `issue_counter`
and `must_change_password` all appear in the descriptions this product will hold, and a subset that
treats `_` as emphasis renders `created_at and updated_at` with an italic run through the middle of
it. Supporting `*` alone costs an author one keystroke of unfamiliarity and removes a whole class of
surprise.

`__bold__` is dropped for the same reason.

### C-3. Inline nodes do not nest

A bold node carries a string, not a child list. `**bold *and italic***` renders bold text containing
literal asterisks. Nesting doubles the inline scanner — a delimiter stack, a rule for crossing pairs,
and a decision about every degenerate case — for a combination a two-line issue description does not
need. Principle III admits machinery for a requirement present today, and `FR-009` names seven
constructs without naming a composition of them.

A link's text is likewise plain: `[**bold**](url)` renders a link labelled `**bold**`.

### C-4. There are no backslash escapes and no bare-URL autolinks

Neither is among the seven constructs. `\*` renders as `\*`, and a URL typed on its own renders as
text rather than becoming a link. Adding escapes would mean adding a rule the specification does not
state, and an author who wants a literal asterisk beside a word can write it beside a space.

### C-5. HTML is escaped because no HTML is ever produced

`FR-009` requires HTML escaped rather than rendered, and `AGENTS.md` requires the renderer to build
React elements and never an HTML string, so `dangerouslySetInnerHTML` never appears. `<b>hi</b>` is
not a construct in C-1, so it falls through to a text node, and React escapes text nodes. The
guarantee is structural: there is no sanitizer to bypass because there is no parser output that could
carry markup.

### C-6. The link allowlist is applied at parse time, and a rejected link becomes its own source text

`FR-010` and `OT-DATA-015`. The scheme is checked while the `[text](url)` construct is being read: an
`http`, `https` or `mailto` URL becomes a link node, and anything else — `javascript:`, `data:`, a
scheme-relative `//host`, an empty href — makes the whole construct a text node carrying the
characters the author typed.

Deciding at parse time rather than at render time means the renderer has no branch and no way to
render an unchecked href, and the allowlist has one call site to test.

### C-7. The module lands in `src/components/shared/markdown/`, and `src/components/ui` stays uncreated

`AGENTS.md` promotes to `src/components/shared` after a real second use, and this is it: project
descriptions on two R5 surfaces, issue descriptions on two R6 surfaces. Two files:

- `parse.ts` — `parseMarkdown(source: string): Block[]`, pure, no React, tested in the node project;
- `markdown.tsx` — `<Markdown source={…} />`, turning blocks into React elements.

Splitting them is not decoration. The escaping and allowlist claims (`SC-013`) are assertions about
the *tree*, and asserting them against a value is sharper and cheaper than asserting them against
rendered DOM. The rendering test then covers what the tree becomes.

`src/components/ui` is still not created. Nothing in this feature is a reusable accessible primitive
with two callers; the rail's controls are React Aria components used once each, and R2 and R5 made
the same call.

### C-8. R5 writes it inside R5, and R6 moves it — a note for R5's planner

The temptation, once this plan exists, is for R5's plan to place the renderer in
`src/components/shared/` from the start and save R6 the move. That would be wrong under Principle I,
which extracts at the second call site precisely so the first does not guess the shared shape, and
the spec's reconciliation says so in as many words. R5 writes it under
`src/features/projects/`; R6 moves it, adds nothing to its behaviour, and repoints R5's two imports.

`FR-044` bounds the move: R5's own description acceptance scenarios pass unchanged and are the
regression test, and a genuine divergence from `OT-DATA-015` found in R5's implementation is an R5
defect fixed as one — not absorbed into this feature's diff.

### C-9. What the move is allowed to change

Only the module path and the two imports. If R5's implementation is missing one of C-1's constructs
or C-6's allowlist, that is C-8's R5 defect. If R5's implementation *exceeds* the subset — supports
something `FR-009` excludes — the same rule applies in the other direction, and R6 does not ship the
excess forward under a shared name.

---

## D. The two screens

### D-1. Both routes fill R2's guard-only pages, and the create route decides existence first

R2 registers `/projects/[projectKey]/issues/new` and
`/projects/[projectKey]/issues/[issueNumber]/details` as pages whose whole body is a guard. This
feature replaces the bodies.

R2's convention is that authorization is decided before existence, so an admin-only route refuses a
member before revealing whether anything is there. **The create route reverses that order, and must.**
`isMember` is a predicate over a project, so there is no membership question to answer until the
project is resolved; a key matching nothing has no project to check against. The spec's own edge case
fixes the outcome — "Create issue opened for a project key that matches nothing reads 'This doesn't
exist' rather than Forbidden" — and `FR-029` and `FR-046` are consistent with it.

The reversal leaks nothing: `OT-AUTHZ-002` makes every project readable by every signed-in user, so
"this project exists" is not a fact membership was hiding. The order is named here because a reader
who knows R2's rule will otherwise read this page as breaking it.

Order on each route:

- `/issues/new` — `requireActor()` · resolve project by key, `notFound()` if none · `isMember`,
  `forbidden()` if not · load columns and the assignee pool · render the form.
- `/issues/:number/details` — `requireActor()` · resolve the issue from `(projectKey, number)`,
  `notFound()` if none · read `isMember` and `isAdmin` for presentation only · render.

The detail route runs no refusal at all beyond sign-in: `FR-021` gives every signed-in user read
access to every issue, and the write boundary is expressed as disabled controls (`FR-026`), never as
a refused page.

### D-2. Every page is a thin async wrapper over a synchronous component

R2's research D-1 established this and it is a runner constraint, not a preference: Vitest cannot
render async Server Components, and this repository has no E2E runner and cannot add one (IV). Every
assertion about what a screen shows must therefore be made against a synchronous component taking
plain props.

So `page.tsx` awaits `params`, runs the guards, runs the queries and renders `<IssueDetail …/>` or
`<CreateIssueForm …/>`, both synchronous and both fully testable. Gate 1 is reachable for every
acceptance scenario in the spec because of this split.

### D-3. The page hands down a DTO, never a database row

`AGENTS.md` forbids exposing rows as UI models. `IssueView` carries: `id`, `key` (`WEB-142`,
formatted server-side), `number`, `title`, `description`, `column` (`id`, `name`, `color`),
`priority`, `assignee` (a `publicUser` projection or `null`), `dueDate` (the `YYYY-MM-DD` string),
`project` (`key`, `name`, `color`), `createdBy` (`publicUser`), `createdAt`, `updatedAt`. No
`sort_order` — nothing on either screen renders order, and shipping it would be a field the client
holds and cannot use.

Every user reference reads through R1's `publicUser` projection (§5, *Read boundary*), which is what
keeps the contact fields off a page that has no business showing them.

Alongside it the page passes `canWrite`, `canDelete` and `writeReason` — booleans decided on the
server and a sentence naming the project. The client never re-derives a predicate; it renders the
answer it was given, and the server check on each mutator is the enforcement (`FR-019`).

### D-4. In-place editing is one component with two call sites on the day it lands

`FR-048` gives title and description identical behaviour — click to edit, Escape reverts, blur or
⌘-enter saves, one call per field — differing only in single-line versus growing multi-line and in
which length bound the inline error names. That is one component, `editable-text.tsx`, with two call
sites in the same commit. Principle I's precondition is met on arrival, not guessed at.

It is not promoted to `src/components/shared`: R5's project details has its own in-place fields, and
if the two prove identical the promotion happens then, with both callers visible. This feature does
not reach into R5 to unify something `FR-044` did not ask it to.

### D-5. Optimistic apply is `useOptimistic`, and rollback is the transition ending

`OT-UX-008` and `FR-050`. `useOptimistic` holds the pending value for the duration of the transition
that wraps the action; when the action returns a failure the transition ends, the optimistic value is
discarded, and the field or control re-renders from the server value — which is the rollback, with no
manual previous-value bookkeeping to get wrong. The failure result then raises the toast that names
what failed and why.

React Compiler is on, so no `useMemo`, `useCallback` or `memo` is written by hand; in exchange the
Rules of React are load-bearing here, and no optimistic value is mutated during render.

Toasts are R2's convention, stated there and first implemented by R3 or R4. This feature consumes
them and does not define them.

### D-6. The rail's four controls are not abstracted behind a shared field

Column, priority and assignee are three React Aria `Select`s and the due date is a date input. The
three selects differ in what they render per item — a colour swatch, a label, a person — and a
`RailSelect` that took a render function would be the indirection Principle III asks to justify from
today's requirements.

The rail is one component holding all four, plus the delete control as its own (D-8). If R10's board
needs the same quick-change controls, that is the second call site and the extraction happens there,
with both shapes known.

### D-7. The due date is a native `<input type="date">`, and `@internationalized/date` is not added

React Aria ships a `DatePicker`, and `AGENTS.md` says to build by hand only where it ships no
equivalent. But driving it means constructing and parsing `DateValue`s, which come from
`@internationalized/date` — a package `react-aria-components` pulls in transitively and which is
**not** in `AGENTS.md`'s approved table. Importing it directly makes it a direct dependency, and gate
4 refuses a dependency whose approval was not recorded beforehand.

A native `<input type="date">` needs no package. It is the platform's own control, so it is not
"hand-built" in the sense the React Aria rule guards against — the keyboard behaviour, the focus ring
and the ARIA semantics are the browser's. And its value is exactly the `YYYY-MM-DD` string the
column stores (A-8), so no conversion exists to get the day wrong in.

**Flagged for the team, not decided here.** R5 reaches this first: `FR-028` of R5's spec gives
Create project a start date and a target date, and R12 will render dates again. If the team wants
React Aria's `DatePicker` across all three, the amendment adding `@internationalized/date` to
`AGENTS.md`'s table should be made **once, before R5 is built**, and this decision reverses to follow
it. What this plan will not do is import an unapproved package and call the approval implied.

### D-8. The delete control confirms in a React Aria `AlertDialog`, and states a size it has none of

`FR-061` puts the control in the rail beneath the four fields, enabled for an admin and visible-but-
disabled with its reason for everyone else. `FR-062` has the confirmation name the issue by key and
title and state the size of what the cascade destroys.

Today the cascade reaches nothing, so the confirmation names the issue and no count — which
`FR-062`, §3.10's own zero-case clause and the spec's edge case all require to read as a normal
confirmation rather than a special one. `AlertDialog` inside `Modal` gives the focus trap, the
`alertdialog` role and the Escape handling; the destructive action is not the autofocused control.

The count's absence is the interesting half: R8 and R11 each add a clause naming their own rows, and
the sentence is built from a list of parts that is empty here. That is not a seam — it is a string
built from an array that happens to have no elements, and the array is read on every render today.

### D-9. The key is the page's first element and the copy-link target

`FR-042`. A small Client Component wrapping a React Aria `Button` that writes `location.href` to the
clipboard. It is the one piece of the main column that is interactive for every user regardless of
membership — copying a link is not a write.

---

## E. Meeting change gate 1 on this feature

### E-1. What runs where

The `server` project (node, `*.test.ts`, `fileParallelism: false`, real PostgreSQL via
`TEST_DATABASE_URL`) takes the schema constraints, the three mutators, the queries, the input parsers
and `parseMarkdown`. The `ui` project (jsdom, `*.test.tsx`) takes every component: the two
synchronous screen components, `editable-text`, the rail, the delete control, the create form and
`<Markdown />`.

Both projects already exist and this feature adds neither, so gate 4 and `AGENTS.md`'s "do not add a
test framework" are untouched.

### E-2. The concurrency scenario needs two connections, not two promises

US1 scenario 3 and `SC-002` require two creations racing in one project. Two `createIssue` calls
awaited together on the same connection serialize in the driver and prove nothing. The test opens a
second `postgres` client, begins a transaction on each, has both draw from the same counter row, and
asserts the second blocks until the first commits and then reads the higher number. `fileParallelism`
is already `false` in the server project, so the two connections are not competing with unrelated
tests for the same rows.

### E-3. The persistence tests need `issue` in the truncation list

`truncateTestDatabase()` truncates a fixed list with `CASCADE`. `"issue"` is added to it in the same
change that adds the table, or every test after the first sees the previous test's rows.

### E-4. The structural requirements are tested by making the database refuse the write

`FR-001`…`FR-008` describe no user journey, and the spec's own preamble fixes the method: a column's
type, bound and constraint by inspecting the generated migration, and a constraint by asserting the
database itself refuses the violating write. So `FR-005` is tested by inserting an issue whose column
belongs to another project and expecting a rejection; `FR-008`'s bounds by inserting 201 and 10 001
characters and expecting rejections, and 200 and 10 000 and expecting success — R1's
`constraints.test.ts` is the pattern, and this feature follows it rather than inventing a second one.

`FR-002`, `FR-003` and `FR-057` are absences. They are asserted against the table object's own keys:
`issue` has no `parentId`, no `status`, no `deletedAt`. A negative assertion is a weak test in
general and the right one here — the requirement *is* that nothing was added, and a reviewer reading
the migration is the second check gate 1 asks for.

---

## Assumptions carried forward

Three, none blocking, each surfaced rather than buried.

- **`issue_counter`'s column is `last_number`, starting at `0`** (A-7). Pinned by this plan because
  R6 is its only reader and R5 has no plan yet. If R5's plan names it differently, A-6's statement is
  the one line that changes.
- **R5's markdown implementation will match C-1's grammar** where it overlaps. If it does not, C-8
  and C-9 make that an R5 defect rather than a widening of this feature's diff — but the size of the
  move cannot be known until R5 exists.
- **`@internationalized/date` stays out of the approved table** (D-7). If the team amends
  `AGENTS.md` before R5 is built, the due-date control becomes React Aria's `DatePicker` and D-7
  reverses. The plan is written so that reversal touches one component.
