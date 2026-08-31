# Phase 0 — Outline & research

**Plan**: [`plan.md`](./plan.md) · **Spec**: [`spec.md`](./spec.md) · **Roadmap**: [`docs/ROADMAP.md`](../../docs/ROADMAP.md) → **R5**

Forty decisions, grouped A–F. Each records what was chosen, why, and what was rejected. Nothing
here widens R5's scope; where a decision touches an earlier entry's module it is named as a
reach-back and repeated in the plan's Complexity Tracking.

Every framework claim below was checked against `node_modules/next/dist/docs/` for the pinned
version of `next`, and every library claim against the installed package rather than against
documentation for it.

Two facts constrain almost everything below and are stated once here rather than in every entry:

- **Only entry R1 is built.** `src/app`, `src/db` and `src/features/auth` exist. R2's `(app)` route
  group, its shell, its Forbidden screen and its guard-only routes do not; neither do R3's accounts.
  R5 consumes all three. See [`plan.md`](./plan.md) → *Technical Context* for the precondition.
- **Vitest cannot render an async Server Component** — the framework's own testing guide says so
  (`node_modules/next/dist/docs/01-app/02-guides/testing/vitest.md`), and this repository has no E2E
  runner and cannot add one (IV). Every requirement therefore has to be reachable through a
  synchronous component, a pure function, or a server module called directly. That is a testability
  constraint on the component boundaries, not a preference (D-1).

---

## A. Schema and migration

### A-1. Four tables, one migration, one file

`project`, `project_member`, `board_column` and `issue_counter` are added to `src/db/schema.ts` and
generated as one migration with `npm run db:generate`. The schema stays a single file because
`drizzle.config.ts` points at it directly and splitting it means editing that config in the same
change (AGENTS.md → Architecture notes).

`src/db/test-database.ts` gains the four names in `TRUNCATED_TABLES`. That list is ordered
parent-last today; `TRUNCATE … CASCADE` makes the order immaterial, but the four names are still
appended ahead of `"user"` so the file continues to read dependents-first.

**Rejected**: a second schema file per feature. It buys nothing at four tables and costs a
`drizzle.config.ts` edit plus a barrel that would mix concerns.

### A-2. `project_member` is keyed by its pair, not by a UUIDv7

`FR-012` states R1's conventions as a blanket, including "server-generated UUIDv7 primary keys".
`FR-005` states the specific case: a membership is "the pair of one project and one user, identified
by that pair". §5 agrees — `(project_id, user_id)` composite PK. The specific requirement governs,
so the table has no `id` column and its primary key is `primaryKey({ columns: [projectId, userId] })`.

This is what makes "a duplicate row cannot exist in any case" (spec, *Edge Cases*) a database fact
rather than a mutator's promise, and it is why `addProjectMember` needs no read-then-write.

The table still carries `created_at` and `updated_at`: `FR-012` names `issue_counter` as this
feature's *only* table outside the timestamp rule.

**Rejected**: a surrogate UUIDv7 key plus a unique constraint on the pair. It satisfies the blanket
sentence and adds a column nothing reads, which is `FR-005`'s "carrying no attributes of its own"
read backwards.

### A-3. `issue_counter` copies `credential`'s shape exactly

The *Clarifications* session fixed the semantics; this decision fixes the columns. R1's `credential`
is already the one-row-per-parent table in this codebase — UUIDv7 primary key, `.unique()` on the
parent reference, `onDelete: "cascade"` — so `issue_counter` is that same shape with `projectId` in
place of `userId`:

```text
issue_counter
  id            uuid PK, $defaultFn(uuidv7)
  project_id    uuid NOT NULL UNIQUE  → project.id  ON DELETE CASCADE
  last_number   integer NOT NULL DEFAULT 0
```

No `created_at`, no `updated_at` — R1's `auth_attempt` is the precedent for a machine table that
carries neither. R6 draws a number with one statement,
`UPDATE issue_counter SET last_number = last_number + 1 WHERE project_id = $1 RETURNING last_number`,
which is atomic on its own row and touches no timestamp and no project row (`OT-DATA-012`).

`integer` is the type: `OT-INV-009` requires monotonicity per project, and a signed 32-bit ceiling of
2.1 billion issues in one project on a self-hosted installation for a team under twenty is not a
bound worth widening. `bigint` would arrive in this codebase as a string through `postgres`, which is
a real cost for no reachable benefit (III).

### A-4. `board_column.sort_order` is seeded with five literal keys, and `fractional-indexing` is **not** installed here

§5 fixes the column as `sort_order text COLLATE "C"`, and AGENTS.md's approved table lists
`fractional-indexing` for the board ordering index. The package is **not** in `package.json` today.

R5 never computes a key *between* two existing keys — it writes five, once, in a fixed order, and
offers no reorder control (`FR-044`). The five values are `a0`, `a1`, `a2`, `a3`, `a4`: valid
base-62 fractional-index keys, ascending under `COLLATE "C"`, and short. What R9 needs of them is
only that they are valid keys in the right order, which `generateKeyBetween` requires of its
arguments and does not require to have produced them — so `generateKeyBetween("a4", null)` appends a
sixth column and `generateKeyBetween("a0", "a1")` inserts between the first two, with no migration
and no reseed.

Approval in AGENTS.md's table is permission to install, not an obligation to. Installing a library to
emit five constants would be a dependency with no computation behind it (IV, III). R9 installs it
when it has an actual insertion to compute.

The seed test asserts the five values and reads the columns back ordered by `sort_order`, so board
order is proven against the database's own collation rather than against the constants' spelling.

**Rejected**: `integer` positions. §5 pins `text COLLATE "C"`, and R10's drag needs an insertable
key space.

### A-4b. `COLLATE "C"` needs `customType`, because Drizzle's `text()` has no collation option

§5 pins `sort_order text COLLATE "C"`, and it is load-bearing: fractional indexing compares keys as
byte sequences, and a base-62 key space mixes digits, uppercase and lowercase, which a locale
collation does not order the way the algorithm assumes. R5's own five keys are lowercase and digits
and would sort identically under either collation — but R9's generated keys will not, and changing a
populated column's collation later is an `ALTER` this feature can avoid by getting the column right
the first time.

`drizzle-orm` 0.45's `text()` takes no collation. `customType` does take an arbitrary `dataType()`,
so the column is declared through a one-line custom type whose data type is `text collate "C"`. It
lives in `src/db/schema.ts` beside the table that uses it, not in a utilities module — it has one
caller (I).

AGENTS.md already requires inspecting the generated SQL before committing a migration. That
inspection is where this is verified: the `CREATE TABLE` must carry `collate "C"` on the column. If
Drizzle Kit emits the column without it, the remedy is a second generated migration carrying the
`ALTER COLUMN … TYPE text COLLATE "C"`, applied while the table is empty — not a hand-edit of the
first one.

### A-5. Uniqueness: a plain `UNIQUE` on the key, a functional unique index on the column name

`project.key` is unique as written — `FR-025` uppercases the field as typed and the pattern admits
uppercase letters and digits only, so case cannot collide and a functional index would be dead
machinery (spec, *Edge Cases*). `.unique()` on the column.

`board_column` needs `UNIQUE (project_id, lower(name))` (`OT-INV-016`, §5), which is a functional
index and therefore `uniqueIndex("board_column_project_id_name_lower_idx").on(table.projectId, sql\`lower(${table.name})\`)`
— the same shape R1 used for `user_email_lower_idx`.

R5 seeds five names that cannot collide and offers no rename, so the constraint has no caller in this
feature. It is created here anyway because the table is created here, and R9's inline-rename clash
(`OT-UX-012`) is enforced by it rather than by `updateColumn`'s read.

### A-6. The date ordering rule is a table `CHECK`, not only a mutator check

`FR-028` requires target ≥ start, refused by the server and not by the form alone, and the spec's
edge cases require the mirror case — setting a *start* later than an already-saved target — refused by
the same rule.

`updateProject` edits one field per call (`FR-036`), so two concurrent calls — one setting `start_date`,
one setting `target_date` — can each read a row that satisfies the rule and together write one that
does not. AGENTS.md is explicit that a read followed by a write is not protection for a
concurrency-sensitive invariant, and this one is concurrency-sensitive. The constraint is therefore
the enforcement:

```sql
CHECK (start_date IS NULL OR target_date IS NULL OR target_date >= start_date)
```

The mutator still validates before writing — not as protection, but because `23514` carries no field
to attach a message to and `FR-028` requires an inline error on a named field. The constraint is the
backstop; the validation is the wording. `updateProject` maps a `23514` on this constraint name to
the same typed refusal, so the two paths produce one message (C-6).

**Rejected**: the mutator alone. It leaves the invariant to a race. **Rejected**: the constraint
alone. It gives `FR-028` no field to put its error on.

### A-7. Colour is a `CHECK` over the seven palette values

`OT-DATA-013` says free colour entry MUST NOT exist. §5 says lowercase six-digit hex. A `text` column
with `CHECK (color IN ('#5b5bd6','#8b909a','#2f7fc4','#d4a017','#3a9d5d','#c8453c','#9b5de5'))` makes
"there is no free colour entry" a property of the data rather than of every form that writes it —
which is what `FR-009` asks for on both tables this feature colours. Widening it for an eighth colour
is an ordinary transactional migration, which is §5's stated reason for `text` + `CHECK` over
`pgEnum`.

### A-8. Length bounds and enumerations follow R1 exactly

`char_length(...) <= 200` for `project.name`, `project.key` and `board_column.name`;
`char_length(...) <= 10000` for `project.description` (`FR-012`, §5). `project.status` and
`board_column.kind` are `text` + `CHECK`, not `pgEnum`. `start_date` and `target_date` are `date`;
`created_at` and `updated_at` are `timestamp({ withTimezone: true })`.

`project.key` also carries `CHECK (key ~ '^[A-Z][A-Z0-9]{0,7}$')`. `FR-002` states the pattern as a
property of the key, `FR-025` states it as a property of the field, and only the first survives a
caller that is not the create form.

### A-9. No index is created beyond the ones the constraints already build

PostgreSQL does not index the referencing side of a foreign key, so the instinct is to add one per
`project_id`. AGENTS.md allows indexes for known query patterns only, and every query this feature
issues is already served:

| Query | Served by |
| --- | --- |
| `isMember` — does this user hold a row in this project | `project_member`'s composite primary key, leading column `project_id` |
| the roster, and both pickers' "already on the roster" exclusion | the same |
| the Columns section, per project in board order | `board_column_project_id_name_lower_idx`, whose leading column is `project_id` (A-5) |
| the key's uniqueness check and its clash lookup | `project.key`'s `UNIQUE` |
| R6's draw, per project | `issue_counter.project_id`'s `UNIQUE` |
| the sidebar's ordering | nothing — it is a sort over every row of a table holding a handful of them, and an index on `lower(name)` would be machinery for a sequential scan that is already cheaper |

**No `project_member_user_id_idx`.** Nothing in R5 filters by `user_id` alone — the reverse direction
is R3's project count and R12's Home, and whichever of them wires that query adds the index with it.

**No `board_column_project_id_idx`.** It would duplicate the leading column of the unique index above.
The `ORDER BY sort_order` is not served by that index, and at five rows per project it does not need
to be.

---

## B. Authorization

### B-1. `isMember` is one server predicate, in `src/features/projects/server/authorization.ts`

```ts
isAdmin(actor)               = actor.role === "admin"
isMember(actor, projectId)   = isAdmin(actor) || hasProjectMemberRow(projectId, actor.id)
```

The admin branch short-circuits before any query, which is what makes `FR-013`'s "no rule this
feature writes carries its own admin branch" true of every caller rather than of the predicate's
first user. It also means an admin's membership check costs no round trip.

R1 already ships the actor (`loadActor`, `requireActor`) and the `admin` role string; this module adds
the project half and nothing else. It is not placed in `src/lib`: it has callers only inside this
feature today, and Principle I extracts at the second.

### B-2. The project is resolved from the key, and every predicate reads the stored row

Every mutator takes a project **identifier from the URL or from the row it is changing**, loads the
project inside the request, and checks the predicate against that loaded row — never against a
project the caller named (`FR-014`, `OT-AUTHZ-004`). `removeProjectMember` derives its project from
the membership row it is deleting, not from an argument.

A missing project is `notFound()`, not `forbidden()`: everyone may read everything, so absence is the
only honest answer (`FR-040`, `OT-UX-004`).

### B-3. The client is handed booleans, never a role

Each screen's Server Component computes `canEditRecord` and `canAdminister` once and passes them
down. `FR-021`'s disabled control and its inline reason are rendered from those booleans; the server
check inside the mutator is the enforcement (`FR-014`), and the two are written in different modules
so neither can be mistaken for the other.

This follows R2's own choice to hand the sidebar `isAdmin` rather than `role`.

### B-4. Origin is asserted first in every Server Action

R1's actions call `assertSameOrigin({ headers: await headers() })` before reading anything. The six
mutators do the same, as their first statement. The framework has its own Server Action origin
handling; R1 established the explicit check, and one convention beats two.

---

## C. The six mutators

### C-1. One `"use server"` module, six exports, and one read

`src/features/projects/actions.ts` carries top-level `"use server"` and is the only module a Client
Component imports server behaviour from — the rule AGENTS.md states and R1 follows with
`src/features/auth/actions.ts`. Sign-in remains the only mutation that is a Route Handler (§6); none
of these six is a public API, a webhook, a callback or a feed.

Each export is a thin entry point: assert origin, require the actor, validate input, delegate to a
module under `server/`, map the result. The transactions themselves live in
`server/create-project.ts`, `server/update-project.ts`, `server/project-status.ts`,
`server/delete-project.ts` and `server/membership.ts`, which are plain async functions a test can
call without a request.

The module also exports the key-availability check (D-5), which is a read. A Server Function is not
required to be a mutation; AGENTS.md reserves Route Handlers for public entry points, and this is not
one.

### C-2. Expected failures are typed results; only the unexpected throws

AGENTS.md: model expected failures as typed results or domain errors. Each mutator returns a
discriminated union, and every arm is a case some acceptance scenario names:

```text
createProject   → { status: "created", projectKey }
                | { status: "key_taken", holder: { key, name } }
                | { status: "invalid", field, reason }
                | { status: "forbidden" }
updateProject   → { status: "saved" } | { status: "invalid", field, reason } | { status: "forbidden" }
setProjectStatus→ { status: "saved" } | { status: "forbidden" }
deleteProject   → { status: "deleted" } | { status: "not_archived" } | { status: "forbidden" }
addProjectMember| removeProjectMember → { status: "saved" } | { status: "forbidden" }
```

`{ status: "forbidden" }` is returned rather than thrown because the caller is a live screen that has
to roll a value back and name a reason (`FR-038`), not a navigation that can be interrupted. The
route-level refusal — a non-admin reaching `/projects/new` — is R2's `forbidden()` interrupt and is a
different thing (`FR-023`).

Nothing in the returned shape carries SQL, a constraint name or a row: AGENTS.md keeps those in
server logs.

### C-3. `createProject` is one transaction writing 1 + 5 + 1 + n rows

`FR-034` requires exactly one call and one transaction. Inside `db.transaction`:

1. insert the `project` row,
2. insert the five `board_column` rows in one statement, with the seed constants (A-4),
3. insert the `issue_counter` row seeded at `0`,
4. insert one `project_member` row per chosen member.

Order matters only in that the project must precede its dependents; the four statements are four
round trips, not one per column. Nothing reads back between them.

### C-4. The key clash is decided by the constraint, and `23505` is caught and named

The as-typed check is an affordance (spec, *Assumptions*); `OT-INV-016` is the enforcement. On
`23505` against `project_key_unique`, `createProject` re-reads the holder by key and returns
`{ status: "key_taken", holder }`, which is what `FR-026` and `OT-UX-012` require — the existing
holder named, never a suffix.

Two concurrent creations of the same key therefore resolve as `SC-003` states: one commits, the other
gets the constraint and is told who holds it. Detecting the code needs the driver's error shape, so
the check is one narrow helper — `isUniqueViolation(error, constraintName)` — tested against a real
violation rather than a hand-built object.

**Rejected**: `onConflictDoNothing` with a zero-row check. It hides which constraint fired, and this
transaction has three that can.

### C-5. `deleteProject` locks the project row and re-reads its status inside its own transaction

`FR-047` and `OT-INV-008` require `archived`, and US4 scenario 9 requires the delete to observe the
status from inside its own transaction rather than from the read that rendered the screen. So:

```text
BEGIN
  SELECT status FROM project WHERE id = $1 FOR UPDATE
  status <> 'archived' → return not_archived, no write
  DELETE FROM project WHERE id = $1          -- the cascade does the rest
COMMIT
```

`FOR UPDATE` is the same tool R1 uses for the last-admin guard, so the pattern is already in the
codebase. The three dependent tables carry `onDelete: "cascade"`, so one `DELETE` is the whole
transaction and `OT-DATA-008`'s "no moment where a row is gone and its dependents are not" is the
database's guarantee, not the mutator's (`FR-050`, `FR-051`).

`redirect()` after the transaction commits satisfies `FR-052`.

### C-6. `updateProject` accepts a partial of exactly five fields

`FR-016` fixes the five — name, description, start date, target date, colour — and `FR-036` has the
screen send one per call. The input is therefore a partial over those five keys, and an unknown key
is a rejection rather than a silently ignored property (II). `key` and `status` are not in the type,
so `FR-016`'s two exclusions are a compile error before they are a runtime check — and a runtime
check as well, since a Server Action's argument arrives over the wire (AGENTS.md: a TypeScript type
is not runtime validation).

The date rule is validated against the *stored* row — the field not being edited is read inside the
same transaction — and the `CHECK` is the backstop (A-6).

`touched()` supplies `updated_at` on every write (`FR-012`).

### C-7. Every mutator calls `refresh()` from `next/cache`

Nothing in this application is cached — no `fetch`, no `unstable_cache`, `cacheComponents` off — so
there is no cache entry for `revalidatePath` to invalidate. What does need updating after a write is
the client router's copy of the rendered tree, and the framework's answer to that in this release is
`refresh()`, which is callable only from a Server Action
(`node_modules/next/dist/docs/01-app/03-api-reference/04-functions/refresh.md`).

It matters here beyond the current page: a project's name, colour or status changes the **sidebar**,
which lives in the `(app)` layout above every screen. A create, a rename, a recolour, a status flip
and a delete all move it.

**Rejected**: `revalidatePath("/", "layout")`. It names a cache this application does not have, and
reads as though one exists.

### C-8. Adding a member takes effect on the next request because nothing caches membership

`FR-046` and `SC-007` require write access on the very next request with no re-authentication. That
is already true by construction: `isMember` reads `project_member` on each request, `loadActor` is
wrapped in React's `cache()` for the duration of one request only, and `OT-SEC-008` forbids caching
identity anywhere. No decision is needed — it is recorded because a reviewer will look for one.

---

## D. The screens

### D-1. Every page is a thin async wrapper over synchronous components

The runner cannot render an async Server Component. So each route file reads, resolves the actor,
computes the two booleans and returns a synchronous component taking plain props. Every acceptance
scenario is then asserted either against that synchronous component under jsdom, against a pure
function, or against a server module called directly under the `node` project.

This is the same decomposition R2 arrived at, for the same reason, and it is why the component list
in [`plan.md`](./plan.md) has the shape it has.

### D-2. In-place editing is one client component with five call sites on day one

`FR-036` and `OT-UX-009` fix the behaviour: click the value, it becomes a field, Escape reverts, blur
or ⌘-enter saves, one call per field. Five fields on the details screen need it the day it ships, so
Principle I's "two call sites before extraction" is satisfied at the first commit rather than
anticipated.

The optimistic half is `useOptimistic` plus the standalone `startTransition`, which is the pattern
the framework's own interactive-apps guide gives for exactly this case
(`node_modules/next/dist/docs/01-app/02-guides/interactive-apps.md`, Step 5): the optimistic value
applies on the current frame, the action runs inside the transition, and a refused write reverts when
the next server render lands. The rollback **message** is the toast (F-3).

Escape reverting is local state, not an optimistic value: nothing was sent.

`useMemo`, `useCallback` and `memo` are not written — React Compiler is on (AGENTS.md).

### D-3. Create project is `useActionState`, deliberately not optimistic

`FR-033` and `OT-UX-008` put create in the "larger write, wait for the server" half. `useActionState`
gives the pending boolean the in-flight state needs and carries the typed result back for the
inline errors, without a second state machine. `redirect()` inside the action does the navigation, so
there is no client-side "navigate on success" branch to get wrong.

`FR-032` keeps the Create control **enabled** while fields are missing, which rules out the usual
`disabled={!isValid}`: the control submits, and the action returns `{ status: "invalid", field }`.

### D-4. Key derivation is one pure function, imported by the client and the server

```ts
deriveProjectKey(name: string): string        // first letter of each word, uppercased, ≤ 8
isValidProjectKey(key: string): boolean       // ^[A-Z][A-Z0-9]{0,7}$
```

`src/features/projects/key.ts` — outside `server/`, because the field runs it on every keystroke and
`createProject` runs it again on what arrives. "3D Redesign" derives `3R`, which fails the pattern, so
the field is left empty and required (`FR-025`); the same function makes that a test with no DOM.

The "stops following the name once edited" rule is one boolean of client state in the key field, not
a comparison against the derived value — a user who types exactly the derived value has still taken
ownership of the field, and comparing values would silently hand it back.

### D-5. The as-typed uniqueness check is a debounced read through the actions module

`FR-026` requires a check against the server as typed and again on submit. The as-typed half is
`checkProjectKeyAvailable(key)` — a Server Function returning the holder's key and name or `null`.
It is debounced in the field, because the framework dispatches Server Functions from the client one
at a time and an undebounced check would queue a request per keystroke ahead of the submit
(`node_modules/next/dist/docs/01-app/01-getting-started/07-mutating-data.md`).

It is a read and it authorizes: the caller must be an admin, because it answers "does a project with
this key exist" to whoever asks. Everyone may read every project anyway, so the check leaks nothing —
but the route it sits on is admin-only and the function matches it.

### D-6. React Aria supplies every control, and `DatePicker` needs one declared dependency

§7's React Aria first rule, and the components 1.20.0 actually exports:

| Control | Component |
| --- | --- |
| Name, key, description | `TextField`, `TextArea` |
| Colour | `RadioGroup` of swatches — a required choice from seven, which is a radio group, not a listbox |
| Members / Add member | `ComboBox` + `ListBox` for the picker, `TagGroup` for the chips |
| Status | `Switch` — `FR-041`'s two-state switch |
| Delete confirmation | `DialogTrigger` + `Modal` + `Dialog`, `role="alertdialog"` |
| Board / Details tabs | `Tabs` + `TabList` + `Tab`, rendered as links |
| Start and target date | `DatePicker` — **see below** |

`DatePicker`'s value is a `CalendarDate` from `@internationalized/date`. That package is in the tree
as React Aria's own runtime dependency (3.12.3) but is **not** declared in `package.json` and **not**
in AGENTS.md's approved table, and `react-aria-components` does not re-export it. Using `DatePicker`
therefore means declaring an existing transitive dependency as a direct one, which gate 4 says needs
recorded approval first.

**This is the plan's one gate-4 item.** It is carried in [`plan.md`](./plan.md) → *Complexity
Tracking* with the recommendation (declare it — the code is already installed and shipped, and the
alternative is a hand-built date control that §7's rule exists to prevent) and the fallback if the
team refuses. No dependency is installed by this plan.

`Toast` ships in 1.20.0 only as `UNSTABLE_Toast*`. R5 does not decide that: the roadmap puts toasts
in R3 or R4, whichever is built first, and R5 consumes the result (F-3).

### D-7. The delete confirmation counts what the cascade reaches, at render

`FR-048` fixes the count as the rows the cascade actually reaches when the confirmation is shown —
board columns and membership rows today. The count is computed by the details query and passed down,
so the dialog is a synchronous component taking a number and the count is asserted without a DOM.

Each later entry that attaches a table to the cascade extends the query. It is stated in
[`contracts/project-details.md`](./contracts/project-details.md) as the obligation `FR-048` puts on
them, so the sentence is not rewritten five times.

### D-8. The Columns section's issue count is `0`, supplied by the query

`FR-044` requires the count; `issue` does not exist until R6. The query returns `0` for each column
and the component takes `issueCount: number`. It is not a placeholder: the section renders the real
shape and the real number, which happens to be zero for every column until R6 lands, exactly as the
spec's own reconciliation says. Recorded in Complexity Tracking rather than left for a reviewer to
find.

### D-9. The sidebar's order is one `ORDER BY`, and the sidebar itself is R2's

```sql
ORDER BY (status = 'archived'), lower(name)
```

`false` sorts before `true`, so active projects precede archived ones, and `lower(name)` makes
"Zephyr", "atlas", "Beacon" order as `atlas, Beacon, Zephyr` (`FR-053`, `OT-UX-020`). No collation is
specified: the ordering must be identical for every user, and the server's own collation is one
setting for the whole installation.

The list is read in R2's `(app)/layout.tsx` and rendered by R2's `project-list-region.tsx`, both of
which this feature edits. That is a reach-back and is recorded as one.

### D-10. The project header composes R2's `ScreenHeader` and adds one prop to it

R2's contract is `name`, `context`, `control`, `newIssue`, composed by the page. `FR-056` needs a
colour dot beside the name and the Board/Details tab pair. The tabs are the `context` slot — §3 puts
them in the title block's second line. The dot has no slot, so `ScreenHeader` gains one optional
`colorDot` prop. A second reach-back, recorded as one.

**Rejected**: passing a node as `name`. It would let any later screen put arbitrary markup in the
title block, which is the drift R2's typed contract exists to prevent.

---

## E. The markdown subset

### E-1. It is written here, it produces React nodes, and it adds no dependency

`OT-DATA-015` fixes a closed grammar: bold, italic, inline code, links, bullet and numbered lists,
headings. Nothing else. HTML is escaped rather than rendered. AGENTS.md states the consequence
directly — build React nodes, never an HTML string, so escaping is React's own and
`dangerouslySetInnerHTML` never appears; a parser dependency would be an unapproved library rendering
a grammar smaller than its own options object.

`src/features/projects/markdown/` holds it: `parse.ts` (source → a block/inline tree) and
`render.tsx` (tree → React nodes). Two modules rather than one because the parse is the part with
sixty test cases and no DOM, and the render is the part that needs jsdom.

R6 is the second call site (spec, *Dependencies*), where Principle I decides whether it is promoted
to `src/components/shared` or `src/lib`. It is not promoted now.

### E-2. The grammar, stated so the tests can be written from it

**Blocks**, split on blank lines, each line classified independently:

| Block | Source |
| --- | --- |
| Heading 1–6 | `#`…`######` + one space |
| Bullet list | consecutive lines starting `- ` or `* ` |
| Numbered list | consecutive lines starting `<digits>. ` |
| Paragraph | anything else |

**Inlines**, applied inside every block: `**bold**`, `*italic*` / `_italic_`, `` `code` ``,
`[text](href)`. Inline code wins over every other marker inside its own span — otherwise
`` `**a**` `` renders bold inside a code span, which is a different document.

**Everything else renders as its own literal text.** A table row, an image, a blockquote, a fence, an
HTML tag: no node type exists for them, so they fall through to the paragraph they were written in and
appear as typed (spec, *Edge Cases*). That is the requirement, not a limitation — `FR-010` says
tables, images and embeds MUST NOT be supported.

### E-3. Link hrefs carry a three-scheme allowlist, checked with `URL`

`http`, `https`, `mailto` (`FR-011`). Anything else — `javascript:`, `data:`, `vbscript:`, a scheme
that only looks like one — renders the link as its literal text rather than as an anchor. The check
parses with the `URL` constructor and compares `protocol`, rather than matching a prefix: prefix
matching is what `java\nscript:` and `JaVaScRiPt:` defeat.

A relative href has no scheme and is not on the allowlist, so it renders as text. Nothing in a project
description should link into the app by relative path, and admitting one would mean deciding what it
resolves against.

### E-4. HTML escaping is structural, and is asserted as such

Because the renderer returns React nodes, `<script>alert(1)</script>` in a description is a text node
containing that string — React escapes it, and there is no code path that could do otherwise. The
test asserts the rendered *text content* equals the source and that no `script` element exists in the
container, which is the assertion that would fail if someone later reached for an HTML string.

---

## F. Testing, and what R5 cannot test

### F-1. The database tests run against real PostgreSQL, as R1's already do

Every constraint this feature adds is a test in the `node` project against `TEST_DATABASE_URL`: the
key pattern, the key's uniqueness, the case-folded column-name uniqueness, the seven-value colour
check, the date ordering check, the four length bounds, the composite membership key, the single
counter row per project, and the cascade. A mock cannot verify any of them (AGENTS.md → Testing).

`src/db/constraints.test.ts` is R1's file and grows; the new tables' own behaviour goes in new files
beside it rather than into it.

### F-2. Three tests need two connections

`SC-003` (two concurrent creations of one key), US4 scenario 9 (archive racing delete) and the
date-ordering race A-6 names each need two transactions open at once. `postgres` gives a connection
per `sql` call from its pool, so two `db.transaction` calls awaited together is enough; the `server`
project already runs with `fileParallelism: false`, so the two are not fighting another file's data.

### F-3. Two things R5 needs and does not build

| | Owner | What R5 does |
| --- | --- | --- |
| The toast that names a rejected write (`OT-UX-008`, `FR-038`) | R3 or R4, whichever is built first — the roadmap's own split | calls it; the rollback itself is R5's and is tested without it |
| The shell, the Forbidden screen, the "this doesn't exist" notice, the disabled-control-with-inline-reason convention | R2 | renders inside them |

Neither is a gap in this plan. Both are the roadmap's sequencing, and both are why implementation is
blocked (see [`plan.md`](./plan.md) → *Technical Context*).

### F-4. Which requirements have no test here, and why

`FR-051`'s "each later entry MUST attach its own tables to the same cascade" is an obligation on R6…R11
and is tested here only for the three tables that exist. `FR-048`'s extension clause is the same shape.
`OT-DATA-012` and `OT-INV-009` are cited by `FR-008` and enforced in R6: what R5 tests is that the
counter row exists, holds `0`, and cannot be duplicated — not that numbers are monotonic, which needs
a caller R5 does not have.

Everything else in the 56 functional requirements is reachable by a test in this entry.

---

## Assumptions carried forward

Three, none blocking:

1. **`project_member` carries `created_at` and `updated_at` that nothing reads today.** `FR-012`
   requires them and names `issue_counter` as the only exception. R7's `member_added` activity row
   carries its own timestamp, so the membership row's may stay unread indefinitely.
2. **The Columns section's issue count is `0` for every column until R6.** Stated by the spec's own
   reconciliation; recorded here because the query returns a literal.
3. **`ScreenHeader` gains `colorDot` before R2 has any other caller for it.** If R2 lands with a
   different header shape, this is the one prop R5's plan expects to add to it.
