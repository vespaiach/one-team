# Phase 0 — Outline & research

**Feature**: Comments and activity feeds · **Entry**: R7 · **Date**: 2026-09-01

**Spec**: [`spec.md`](./spec.md) · **Plan**: [`plan.md`](./plan.md)

Twenty-nine decisions in six groups — six on the schema, four on the activity-writing primitive, six
on the three comment mutators, five on the reach-back into R5's and R6's mutators, four on the
mention token, and four on the shared feed component. Nothing here widens the spec's scope; where a
decision settles something the specification left open, it says so and cites the sentence that left it
open. The spec's own *Assumptions* section already closed nine judgment calls at the product level —
this file does not re-open them. What it adds is the layer beneath: what PostgreSQL, Next.js 16 and
the seven mutators this feature edits already commit to.

---

## A. Schema, and one discovery about what already shipped

### A-1. Two tables, appended to the single schema file in the spec's own order

`src/db/schema.ts` is the whole schema and `drizzle.config.ts` points at it directly (`AGENTS.md` →
Architecture notes). This feature appends `comment` then `activity` — the order FR-001 and FR-002
state them in, and the order `comment_id` on `activity` reads naturally, since a table cannot
reference one declared after it in one Drizzle file without both existing at parse time; declaring
`comment` first avoids a forward reference for no reason.

### A-2. "Exactly one of issue or project" is `num_nonnulls`, not a hand-written boolean pair

`OT-INV-010` and FR-001/FR-002 require the CHECK on both tables. PostgreSQL's built-in
`num_nonnulls(a, b) = 1` states the rule in one call; the hand-written alternative —
`(issue_id IS NOT NULL) <> (project_id IS NOT NULL)` — says the same thing in more characters and
needs a reader to work out that `<>` on two booleans is XOR. `num_nonnulls` is standard PostgreSQL 18,
needs no extension, and is the version a reader takes at face value (Principle III).

```sql
CHECK (num_nonnulls(issue_id, project_id) = 1)
```

**Rejected**: a discriminator column (`target_type: 'issue' | 'project'`) plus a single
`target_id`. It would need its own CHECK tying the discriminator to which column is legitimately
readable, and every query would branch on it — two nullable foreign keys, each pointing at exactly
one table, is what the two possible targets already are without inventing a third column to name them.

### A-3. Both target references cascade at the column, and neither is a composite key

`issue_id` references `issue(id) ON DELETE CASCADE`; `project_id` references `project(id)
ON DELETE CASCADE`. Unlike R6's `issue.column_id` (research.md A-3/A-4 there), neither reference here
pairs with a second column to enforce a cross-table invariant, so there is no composite foreign key to
declare and no `NO ACTION` ordering question to reason about — a comment or an activity row belongs to
exactly one project or one issue, full stop, and PostgreSQL removes it the moment that row goes,
independently of whatever else the same statement's cascade also reaches (FR-001, FR-002, `OT-DATA-011`).

### A-4. `activity.comment_id` is nullable, cascades from `comment`, and is `CHECK`-tied to `type = 'comment'`

FR-002 says the column is "used only by rows of type `comment`". That sentence is a constraint, not
only a description, so it is written as one:

```sql
CHECK ((type = 'comment') = (comment_id IS NOT NULL))
```

`ON DELETE CASCADE` on `comment_id` is what FR-048 calls "removed by the database cascade… not by a
second statement this mutator issues": deleting a comment removes its own `comment`-type activity row
as a property of the schema, not of `deleteComment`'s body.

**Rejected**: leaving the pairing as a comment (forbidden under V) or as a runtime assertion inside
`writeActivity` (research B). A `CHECK` is enforced on every insert this feature's own writer performs
and on any the roadmap's own precedent — R8, R9 widening `activity.type` later — might add, without
depending on every future caller remembering the rule.

### A-5. `activity` carries no `updated_at`, and the absence is asserted the way R6 asserted `issue.status`'s

FR-003 requires the column's absence, not its presence-and-unused. Following R6's E-4 precedent, the
test reads the table object's own keys — `activity` has no `updatedAt` — rather than trying to prove a
negative through behaviour. `comment.updated_at` is present and is written through `touched()` on
every `updateComment` call, per R1's convention (FR-005, §5).

### A-6. `activity.type`'s `CHECK` names seven values, and the incremental-widening decision is a schema fact now

The spec's own *Assumptions* section already settles this as a product judgment call
(FR-004); this entry states what it becomes in `src/db/schema.ts`: `text` with

```sql
CHECK (type IN ('created', 'field_changed', 'member_added', 'member_removed',
                 'archived', 'reopened', 'comment'))
```

not `pgEnum`, matching every enumerated column R1, R5 and R6 already declared this way. R8 and R9 each
widen this same `CHECK` with their own generated migration when they land — an ordinary transactional
migration, per the specification's §5 and per R6's own precedent of altering a table it does not own
(R6 research A-3).

### A-7. `user.feed_filter` already exists — R1 built it a release ahead of FR-006, and this feature's migration touches no column on `user`

FR-006 frames `feed_filter` as a column this feature's migration adds. Inspecting the *shipped* schema
tells a different story: `src/db/schema.ts`'s `user` table already carries
`feedFilter: text("feed_filter").notNull().default("all")` with
`CHECK (feed_filter in ('comments', 'all'))`, written into `drizzle/0001_chubby_stellaris.sql` by the
commit `0b3478b` — "R1 phase 1-2 — schema, shared auth modules and the common layout" — the same
migration that created the `user` table itself. R4's design brief named the column as deferred to this
feature; R1's implementation got there first, with exactly the type, default and constraint FR-006
specifies.

This is recorded as a fact about the codebase, not a spec correction: FR-006's requirement is still
true — the column exists with the shape it names — and nothing here reads as R1 having exceeded its
own scope, since the column sits unread and unexposed until this feature builds the one mutator (§C-6)
and the one screen surface that touch it. What changes is this feature's migration: it adds `comment`
and `activity` and alters nothing on `user`, where a plan written from FR-006 alone would have
expected an `ALTER TABLE user ADD COLUMN feed_filter …` statement that turns out to already exist.
Recorded in [`plan.md`](./plan.md)'s Technical Context so a reviewer meets the discrepancy once, in
prose, rather than as a migration that generates empty.

### A-8. Two indexes per table, plain rather than partial, are what the feed's own reads justify

`AGENTS.md` allows indexes for known query patterns only. This feature has exactly one read pattern
per table — "every row on this issue, or this project, newest first, paginated" (§F) — so each table
gets:

```sql
CREATE INDEX ON comment  (issue_id, created_at);
CREATE INDEX ON comment  (project_id, created_at);
CREATE INDEX ON activity (issue_id, created_at);
CREATE INDEX ON activity (project_id, created_at);
```

The project-scoped `comment` index doubles as FR-059's comment-count read — `count(*) … WHERE
project_id = $1` is a prefix scan of the same index, so no third index is added for the header count.

**Rejected**: partial indexes (`WHERE issue_id IS NOT NULL` / `WHERE project_id IS NOT NULL`). Each
row NULLs exactly one of the two columns by A-2's own CHECK, so a plain index carries no row it could
not use — the partial form would save a small amount of index size at a team scale under twenty for a
saving the spec states no performance target to justify (Principle III: no machinery for a requirement
not present today).

---

## B. The activity-writing primitive

### B-1. It lives where the table it writes lives: `src/features/activity/server/write-activity.ts`

FR-011 requires one function, called by this feature's own three comment mutators and by seven edits
into R5's and R6's mutators before either R8 or R9 exist. Its natural home is the feature that owns
`activity`, not a promotion to `src/lib` — `AGENTS.md`'s promotion rule governs *components*, and this
is a server-only domain function whose cross-feature import is already the shape R1's `publicUser` and
`requireActor` take: every later entry imports them directly from `src/features/auth/server/`, and
`src/features/activity/server/write-activity.ts` is imported the same way by
`src/features/projects/server/*.ts` and `src/features/issues/server/*.ts`.

### B-2. The signature carries a target union, not two optional ids

```ts
type ActivityTarget = { issueId: string } | { projectId: string };

function writeActivity(
  tx: Transaction,
  input: {
    type: ActivityType;
    target: ActivityTarget;
    actorId: string;
    field?: string;
    fromValue?: string | null;
    toValue?: string | null;
    commentId?: string;
  },
): Promise<void>
```

A discriminated union makes "exactly one target" a property of the type a caller can be wrong about at
compile time, matching A-2's database-level CHECK with a TypeScript shape that agrees with it, rather
than two optional fields a caller could set both or neither of and learn about it only from a
constraint violation.

### B-3. It performs three things and refuses everything else, by FR-013's own list

Open a transaction: no — every caller supplies `tx`, already open (FR-011, FR-013). Authorize: no —
every caller has already run its own predicate before this is reached. Compute what changed: no —
`updateIssue` already computes its delta for its own SET-list (R6 research B-6) and `updateProject`
gains the same shape here (§D-2); the writer receives the answer, never derives it. Its whole body is
one `INSERT`.

### B-4. Ten call sites exist inside this feature alone, which is what keeps it off Principle I's speculative list

FR-012 states the count and this file is where it is verified: `createComment` (§C-1), `createProject`
(§D-1), `updateProject` (§D-2, one call per differing field), `setProjectStatus` (§D-3),
`addProjectMember` and `removeProjectMember` (§D-4), `createIssue` (§D-5), `updateIssue` (§D-6, one
call per differing field). That is eight call *sites*, several firing more than once per invocation —
well past the two-call-site bar Principle I sets, entirely inside this feature, before R8 or R9 are
considered.

---

## C. The three comment mutators, and the one that isn't about a comment

### C-1. All four are Server Actions under `src/features/activity/actions.ts`, following R5's and R6's shape exactly

`createComment`, `updateComment`, `deleteComment`, `setFeedFilter` — none is a public API, webhook,
callback, feed or sign-in, so none is a Route Handler (`AGENTS.md` → Next.js 16 and the server
boundary). Each is a thin entry point over `src/features/activity/server/`. The order every mutator
follows is R5's own, restated because it is inherited rather than re-derived: assert same origin →
`requireActor()` → validate → resolve the stored row → authorize against it → write → `refresh()` →
return a typed result never carrying SQL, a constraint name or a row.

### C-2. `createComment` derives its project from the target it was given, exactly as `createIssue` derives it from the route

FR-015 and FR-046. The input is one of `{ issueId }` or `{ projectId }` — the same union B-2 gives the
writer. For an issue target, the project `isMember` runs against is read from the stored issue's own
`project_id`, never accepted as a second argument the caller could point somewhere the issue does not
belong (`OT-AUTHZ-004`). For a project target, the target is the project.

### C-3. `updateComment` and `deleteComment` never resolve a project at all

FR-016. Their predicate is authorship (`updateComment`) or authorship-or-`isAdmin` (`deleteComment`),
checked against the comment's own `author_id` — a fact that does not change when the author leaves the
project (FR-017). Neither mutator reads `isMember` of anything, which is the concrete shape of "MUST
require nothing else" in FR-016's wording.

### C-4. `createComment` is one transaction: validate, insert, write one `comment`-type activity row

FR-045. Body validation (trim, required, ≤ 10 000 characters) happens before the insert, so an invalid
body never reaches the writer. The activity row's `comment_id` is the just-inserted comment's id,
carrying no `field`, `from_value` or `to_value` — A-4's CHECK is what makes that pairing structural
rather than a convention this transaction has to remember.

### C-5. `updateComment` writes one column and calls the writer never

FR-047. `UPDATE comment SET body = $1, updated_at = touched() WHERE id = $2` is the whole transaction
— no read-then-diff, because there is nothing to log: the comment row is its own feed entry, read live
on every render (data-model §4), which is the opposite half of the frozen-vs-live pair B-3 already
named for `field_changed` rows.

### C-6. `setFeedFilter` needs no transaction wrapper, and its predicate is "signed in" alone

FR-034. One statement — `UPDATE user SET feed_filter = $1 WHERE id = $2` — over one row identified by
the actor's own session, so there is no second statement for a transaction to make atomic with it and
no project to derive a predicate from. This is the "requires only self" category §2 already places
`updateOwnProfile` and `markNotificationRead` in; the FR itself states the parallel in prose rather
than through an index-ID citation, because no assigned ID names that category generally (spec §5,
correcting an earlier draft's citation to `OT-AUTHZ-016`, which is specifically about
`markAllNotificationsRead`'s own scoping and not a category this mutator belongs to).

---

## D. The reach-back into R5's and R6's mutators — and the one place it is not a one-line addition

### D-1. `createProject` gets the addition R5's own contract already reserved for it

R5's `contracts/mutators.md` states this outcome before this feature exists: *"No activity row is
written. R7 adds `created` and one `member_added` per member to this same transaction."* FR-050 is
that addition — one `created` call naming the actor, then one `member_added` call per row the same
transaction inserts into `project_member`, each carrying that member's display name in `to_value`
(read from the same `publicUser` projection the picker already resolved the id from). No diffing, no
new read: the insert already knows every member id it is about to write.

### D-2. `updateProject` does not yet compute a diff, so this feature adds the computation, not only the call

This is the one reach-back that is not "insert a line where the answer already exists." R5's own
`contracts/mutators.md` describes `updateProject` reading the stored row only *conditionally* — "when
`changes` carries one date, the other is read inside the same transaction" — for the date-ordering
check alone, and writing whatever partial it was given with no comparison against the stored value.
`updateIssue`, by contrast, already computes a full delta for its own SET-list and no-op behaviour
(R6 research B-6), so R7's edit there really is one line at an existing point (§D-6).

FR-051 requires `updateProject` to know, for every field the call names, whether it actually differs
from what is stored — because writing a `field_changed` row for a call that changed nothing would put
a false entry in the feed, and `SC-003` requires "zero rows produced for a call that changes nothing."
So this feature generalizes the existing *conditional* read into an *unconditional* one:

```text
BEGIN
  SELECT * FROM project WHERE id = $1 FOR UPDATE      -- was: read only when a date field was named
  run the predicate against the locked row
  validate every named field
  diff: for each key in `changes`, compare to the locked row               ← new
  if the diff is empty: COMMIT having written nothing                      ← new
  UPDATE project SET <differing columns only> = …, updated_at = touched()
  for each differing field: writeActivity(tx, { type: 'field_changed', … }) ← new
COMMIT
```

`FOR UPDATE` was already there for the date pair; this feature widens its scope to the row rather than
adding a second lock, so no new concurrency primitive is introduced — the same statement now serves
two callers' needs instead of one's. Recorded in [`plan.md`](./plan.md)'s Complexity Tracking, because
"R7 only adds a call to the writer" is true of six of the seven mutators it touches and false of this
one, and a reviewer who assumed otherwise from the other six would miss the diff-and-no-op logic this
one actually adds.

**Rejected**: leaving `updateProject` as-is and writing a `field_changed` row unconditionally whenever
the mutator is called. `SC-003` refuses it directly, and `FR-051`'s own words — "after determining
which of its five fields differ" — already assume the determination happens.

### D-3. `setProjectStatus` needs no read at all — the target value is the whole answer

FR-052. The mutator's own input already carries the direction: `status = 'archived'` writes one
`archived` row, `status = 'active'` writes one `reopened` row, neither carrying `field`, `from_value`
or `to_value`. No SELECT is added because none is needed — the type alone is the entry, matching the
column's own meaning (A-6).

### D-4. `addProjectMember` and `removeProjectMember` each gain one lookup they did not need before

FR-053. Neither mutator currently reads the target user's row — `addProjectMember` inserts a
`(project_id, user_id)` pair it already has both halves of, and `removeProjectMember` deletes by the
same pair. Freezing a display name in `to_value` or `from_value` needs that user's `publicUser`
projection, which is one added `SELECT` inside each transaction, not a structural change to either
mutator's shape.

### D-5. `createIssue` gets one call, unconditionally, with no equivalent to D-2's problem

FR-055. Every value `createIssue` accepts — column, priority, assignee, due date — is a value being
*set for the first time*, not a change from a prior state, so there is nothing to diff. One `created`
row, naming the actor, is the whole addition.

### D-6. `updateIssue` gets one call per differing field, at the line R6's own plan already named

FR-056. R6's `contracts/mutators.md` states this outcome in as many words: *"R7 and R11 extend the
function at the line where it already exists"* — step 4 of `updateIssue`'s transaction, where the
delta is computed for the SET-list. This feature adds one `writeActivity` call per entry in that
delta, after the `UPDATE` commits its column list, translating `column_id` and `assignee_id`'s changed
values to their names (not their ids) before freezing them, per FR-007's frozen-display-string rule.

### D-7. `deleteIssue` and `deleteProject` change no line of either function's body

FR-058. `comment.issue_id`, `comment.project_id`, `activity.issue_id` and `activity.project_id` all
carry `ON DELETE CASCADE` (A-3) — the arm attaches at the schema, exactly as R6's own `data-model.md`
§5 already lists both tables under "Arm … Declared by … R7" before this feature was written. Neither
delete mutator's transaction gains a statement.

---

## E. The mention token

### E-1. Resolution is a plain-text substitution pass, run once per render, over a body already known to be plain text

FR-022. `comment.body` holds `@[<user_id>]` tokens inline in otherwise-plain text (FR-010) — there is
no markdown tree to walk, unlike R6's `parseMarkdown` output, so resolution is a regex pass:
`/@\[([0-9a-f-]+)\]/g` replaced with each id's current `publicUser` display name, batched in one query
over the distinct ids a single comment's body names. No user id ever needs a fallback string, because
users are never hard-deleted (`AGENTS.md`'s §4 convention, already load-bearing for R6's `assignee_id`
— research A-5 there) — a token's target is guaranteed to resolve for as long as the comment exists.

### E-2. The autocomplete list is one query returning two ranked groups, not one query filtered twice

FR-024. R6's assignee pool (`issue-queries.ts`, research D-3 there) already returns exactly one ranked
group — project members plus every admin — because that is all a Select needs. A mention picker needs
that same group **and** everyone else, ranked below it, so this feature's query is a superset:
`project_member` rows for the target's project, plus every admin, unioned with every other
non-deactivated user, tagged by which group each row fell into. The picker sorts on that tag, never on
two separate round trips.

### E-3. The list is re-fetched on every keystroke, debounced, following R5's `checkProjectKeyAvailable` precedent exactly

FR-024 requires the list "re-read live on each keystroke rather than cached from when the composer
opened" — deactivation between two keystrokes must be reflected, which a client-side filter over a
list fetched once cannot do. R5's key-availability check is already this exact shape: a debounced
Server Function call per keystroke, because the framework dispatches Server Functions one at a time
and an undebounced call would queue one request per character ahead of whatever the user does next
(R5 research, `checkProjectKeyAvailable`). This feature's mention query reuses the pattern rather than
inventing a second one.

### E-4. The picker is built from `Popover` and `ListBox`, the one named exception to React Aria's own component set

FR-025, `AGENTS.md` → React Aria Components. No `ComboBox` or `Autocomplete` component fits: the
trigger is a `@` keystroke inside a text field's content, not a labelled field of its own, which is
exactly the shape `AGENTS.md` names as the single case built from primitives rather than a complete
component.

---

## F. The shared feed component

### F-1. Pagination is keyset over a `UNION ALL`, not `OFFSET`, because a page boundary must survive a concurrent post

FR-032, FR-037. `OFFSET`-based paging shifts every row after an insert lands between two page loads —
a reader who has loaded 50 rows and scrolls for the next 50 could see the 50th row again or skip the
100th, depending on which side of the boundary the new row landed. The feed's own optimistic posting
(FR-037) makes a concurrent insert an ordinary occurrence, not an edge case, so the read is:

```sql
SELECT * FROM (
  SELECT id, 'comment' AS kind, author_id AS actor_id, created_at, …  FROM comment  WHERE issue_id = $1
  UNION ALL
  SELECT id, 'activity',        actor_id,               created_at, …  FROM activity WHERE issue_id = $1
) feed
WHERE (created_at, id) < ($cursorCreatedAt, $cursorId)   -- omitted on the first page
ORDER BY created_at DESC, id DESC
LIMIT 50
```

`id` is UUIDv7 (§5), so it is itself time-ordered — the secondary sort key needs no extra column, and
two rows written in the same transaction with an identical `created_at` (FR-050's "all timestamped
together") still resolve to a stable order rather than an implementation-dependent one.

### F-2. Collapsing (FR-031) is a client-side transform over an already-paginated page, and the query knows nothing about it

FR-032 fixes the count "before FR-031's collapsing is applied", which settles the layering: the server
returns 50 raw rows; the component folds consecutive same-actor non-`comment` rows within five minutes
of each other into one expandable group as a rendering step. Moving collapsing into the query — a
window function grouping adjacent rows — would make the *page size* depend on how bursty a given
stretch of history happens to be, which is exactly what FR-032 rules out.

### F-3. One component serves both call sites because both exist in this feature, at the exact place the roadmap names

FR-026. The roadmap's §1.1 names this feed as the worked example of Principle I's "second call site"
rule applied on day one rather than waited for: the issue feed and the project feed are not a first
caller and a hoped-for second one, they are two renders of the same component inside one commit. R6's
own `editable-text.tsx`, by contrast, stayed unpromoted because its second call site — R5's fields —
belonged to a different feature (R6 research D-4); nothing here is in that position.

### F-4. Comment rows and activity rows share one row-shape query, distinguished by `kind`, not two components stitched together

F-1's `UNION ALL` already returns one shape; the feed component switches on `kind` per row rather than
running two queries and merging client-side. A `comment` row additionally carries its own `body`,
`author_id` and edit/delete affordances (FR-028); an `activity` row carries `type`, `field`,
`from_value`/`to_value` and never a control. One query, one component, one `switch`.

---

## Assumptions carried forward

None outstanding. The spec's own *Assumptions* section closed every product-level judgment call before
this file was written; what this file adds is discovered rather than assumed — A-7's `feed_filter`
column already existing is a fact read off the shipped migration, not a default chosen where the
source was silent, and D-2's `updateProject` diff is a consequence of what R5's own contract does and
does not already compute, not a guess about it.
