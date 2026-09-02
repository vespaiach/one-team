# Phase 0 — Outline & research

**Feature**: Labels · **Entry**: R8 · **Date**: 2026-09-01

**Spec**: [`spec.md`](./spec.md)

Twenty decisions in four groups. Each restates a functional requirement, a cited `OT-` id, or a
convention `AGENTS.md` already fixes — nothing here is chosen freely, and each row says which.

---

## A. Schema

### A-1. Two tables, `label` and `issue_label`, appended to the single schema file

`src/db/schema.ts` gains both, after R6's `issue`. §5 names both tables and both are this feature's
to create — nothing upstream defines either.

```
label
  id            uuid PK, $defaultFn(uuidv7)
  name          text NOT NULL
  color         text NOT NULL
  created_at    timestamptz NOT NULL
  updated_at    timestamptz NOT NULL

issue_label
  issue_id      uuid NOT NULL → issue.id   ON DELETE CASCADE
  label_id      uuid NOT NULL → label.id   ON DELETE CASCADE
  PRIMARY KEY (issue_id, label_id)
```

### A-2. `issue_label` takes a composite primary key, no synthetic id, no timestamps

`R5`'s `project_member` is the precedent this feature inherits rather than re-decides: `(project_id,
user_id)` composite PK, no role column, no lifecycle of its own. `issue_label` is the same shape — a
fact ("this issue currently carries this label"), not a record with a history. A synthetic `id` would
be a column FR-022's no-op rule never reads, and `created_at` would be a field no requirement orders
by; `label`'s own list is alphabetical by name (FR-003), never by when an attachment was made. Neither
column is built (VI).

### A-3. Both foreign keys cascade, and this is the arm R6 already named

R6's [`data-model.md`](../006-issues-creation-detail-editing/data-model.md) §5 lists
`issue_label.issue_id ON DELETE CASCADE` under *the cascade, today and as it grows*, attributed to R8,
before this feature existed to declare it. `OT-DATA-007` and `OT-DATA-008` require the same for the
label side — deleting a label removes its `issue_label` joins in the same transaction, the issues
themselves untouched (spec §4, *Deleting a label*). Declaring both as `ON DELETE CASCADE` at the
database means `deleteIssue` and `deleteLabel` need no code of their own to reach this table; each
already runs its own delete in one transaction (R6's `deleteIssue`, this feature's `deleteLabel`), and
the database does the rest. Neither mutator's body changes when this table appears — the same
guarantee R6's own cascade section states for its future callers.

**Rejected**: a foreign key without a cascade action, cleaned up by application code in each mutator.
Two call sites would each need to remember the join table exists, and a future entry cascading into
`issue` or `label` would need to remember it too. A constraint cannot be forgotten; a line of code can.

### A-4. `issue_label_label_id_idx` is the one index this feature must add by hand

The composite primary key `(issue_id, label_id)` serves every query that starts from an issue — the
rail's "which labels does this issue carry" read — because `issue_id` is its leading column. It serves
nothing that starts from a label. Two things do: the labels page's per-label usage count (FR-003, a
`COUNT(*) GROUP BY label_id` over the whole table) and `deleteLabel`'s cascade, which the database
walks by `label_id` to remove every matching row. `AGENTS.md` states plainly that PostgreSQL does not
index the referencing side of a foreign key, and both of those are query patterns this feature itself
issues — not a future entry's, the case `AGENTS.md` says to leave unindexed. So:

```
index("issue_label_label_id_idx").on(table.labelId)
```

### A-5. `label.name` is unique through a functional index on `lower(name)`

`OT-INV-016` names `lower(label.name)` explicitly, and FR-007's clash check is case-insensitive.
`user_email_lower_idx` (R1) and `board_column_project_id_name_lower_idx` (R5, its research A-5) are
the two precedents for the same shape: `uniqueIndex("label_name_lower_idx").on(sql\`lower(${table.name})\`)`.
A plain `.unique()` would let `Bug` and `bug` coexist, which FR-007 forbids.

### A-6. Colour is the seven-value `CHECK` R5 already wrote, not a new literal

R5's research A-7 pins `CHECK (color IN ('#5b5bd6','#8b909a','#2f7fc4','#d4a017','#3a9d5d','#c8453c','#9b5de5'))`
for `project.color` and `board_column.color`. `OT-DATA-013` names labels in the same sentence as those
two tables — "project, board column, label" — so `label.color` carries the identical constraint, not a
third literal a reader would have to diff against the first two to trust. §5, *Stack → Palette* is the
one place the seven values are stated in prose; this feature does not restate them, it reuses the
constraint R5 already wrote against that same prose.

### A-7. `label.name` is bounded at 200 characters, the same convention as every other short field

§5: "every free-text column is length-bounded by a `CHECK`: 200 characters for names, titles, keys and
handles". `label.name` is a name. `char_length(name) <= 200`, refused inline per FR-007's clash-and-length
validation and the edge case the spec states — nothing is truncated.

---

## B. The palette moves to a shared module — this is its second feature

R5's plan put the seven values and their names at `src/features/projects/palette.ts`, and the swatch
`RadioGroup` at `src/features/projects/components/palette-field.tsx` — deliberately *not* promoted,
because R5's own two uses (`project.color`, `board_column.color`) are both inside R5's own feature, and
`AGENTS.md`'s Structure section reserves `src/components/shared` and `src/lib` for "a real second use,"
which within one feature directory is not yet the bar Principle I sets.

### B-1. `label.color` is the second *feature*, and that is the bar Principle I actually draws

The line in `AGENTS.md` is "a pattern must appear at two call sites before it is extracted into a
shared component, hook, or module" — not two call sites in one feature. R5's internal reuse already
satisfied that bar for R5's own purposes without crossing a feature boundary, which is why R5 kept it
local. `label.color` is a second, independent feature needing the identical seven values, the identical
names, and the identical swatch-picking interaction with no label-specific behaviour mixed in. This
feature therefore **moves, not copies**:

- `src/features/projects/palette.ts` → `src/lib/palette.ts` — pure data, no JSX, which is exactly what
  `AGENTS.md`'s `src/lib` is for.
- `src/features/projects/components/palette-field.tsx` → `src/components/shared/palette-field.tsx` —
  the mirror of R6's own move of R5's markdown renderer to `src/components/shared/markdown/`, the same
  reasoning applied to a second recurring pattern rather than a novel one.

Both moves repoint two existing imports inside R5's feature; neither changes what R5 renders or the
`CHECK` constraints A-6 already reuses byte for byte. This is a reach-back into R5's inherited work
and is recorded in [`plan.md`](./plan.md)'s Complexity Tracking, the same way R6 recorded its move of
R5's markdown module.

**Rejected**: a second, label-scoped copy of the seven values and the swatch picker. Two literals that
must be kept in lockstep by hand is precisely the drift Principle I extracts to prevent, and R9's board
columns are a third caller already named in the roadmap — leaving the pattern local here would only
move the same decision one entry later, at higher cost, since the ninth entry did not write either
copy.

**Rejected**: waiting for R9 to be the one that promotes it, since R9 is also a real caller. R9 has no
spec yet, its build order is independent of R8's (roadmap §3: "R8 and R9 are independent of each other
and may be built in parallel once R7 lands"), and a shared module that is not shared until a third
caller shows up would leave R8's own second-caller obligation unmet in the meantime.

---

## C. The five mutators

### C-1. Authorization matches §2's write-rules table with no branch of its own

`createLabel`, `updateLabel`, `deleteLabel` — `isAdmin`. `addIssueLabel`, `removeIssueLabel` —
`isMember` of the label's own issue's project, derived server-side from the issue's stored
`project_id`, never from an argument (FR-020, the same rule R5's B-3 and R6's B-3 already state for
every `isMember` check in the system). No mutator here introduces a sixth predicate; §2 lists all five
by name.

### C-2. `createLabel` and `updateLabel` take typed arguments, not a form action

Both live in a modal that never navigates (§3.10: "a modal with a name field and a colour picker"), so
there is no route to redirect to on success and no full-page `useActionState` submission to model. Each
is a Server Action called from a client wrapper — `useActionState` bound to the modal's local state,
reporting the per-field, on-blur validation `OT-UX-011` requires (required, trimmed, unique) without a
page transition. This is the same reasoning R6's B-2 used to split `createIssue` (a form action, because
it is a full page) from `updateIssue` and `deleteIssue` (typed arguments, because neither navigates);
here both of this feature's curation mutators land on the typed-argument side of that same line.

### C-3. The uniqueness check is two layers, the same shape R5 already built for the project key

A pre-check — `checkLabelNameAvailable(name)`, admin-only, debounced in the field — answers the on-blur
validation FR-007 asks for, naming the existing label on a clash. The functional unique index (A-5) is
the actual enforcement: a race between two admins creating the same name concurrently is refused by the
constraint, not by the pre-check, exactly the two-layer shape R5's research D-5 built for
`checkProjectKeyAvailable`. Reusing the shape rather than reinventing it means the failure mode a
reviewer already knows from R5 is the failure mode here too.

### C-4. `deleteLabel`'s stated count and its actual delete read the same query, inside one transaction

FR-011 requires the confirmation to name the exact count before anything is destroyed; FR-012 requires
the delete and the count it affects to be the settled state the response carries. Both read
`COUNT(*) FROM issue_label WHERE label_id = $1` — the confirmation modal reads it to render the
sentence, and the delete transaction re-reads it (or simply deletes and reports the row count the
database itself returns) so the number shown and the number actually removed can never diverge from a
concurrent add or remove landing between the two — the spec's own Assumptions section already states
this is resolved by last-write-wins, consistent with how every other concurrent write in this product
is handled, not by a lock held across the confirmation dialog's open time.

### C-5. `addIssueLabel` and `removeIssueLabel` are idempotent, not error-on-duplicate

FR-022 requires adding an already-present label to be a no-op, not a duplicate row and not a duplicate
`label_added` activity row. `addIssueLabel` is `INSERT ... ON CONFLICT (issue_id, label_id) DO NOTHING`,
its cheapest correct form given the composite primary key A-2 already declares — no read-then-write, no
predicate the mutator has to compute. `removeIssueLabel` is a `DELETE` matching zero or one row and
never raises when it matches zero; the picker only ever offers removal for a label the client already
believes is present, and a stale client removing something already gone is exactly the same shape as
every other rail control's disabled-becomes-stale-mid-session handling — it settles, it does not error.

**Activity follows the write, not the intent.** Each mutator writes its `label_added` /
`label_removed` row only when its own statement actually changed a row — `INSERT ... DO NOTHING`
returning nothing writes no activity; a `DELETE` matching nothing writes none either. This is the same
principle R6's B-7 states for `updateIssue`'s no-op save: a call that changes nothing writes nothing,
observable in the same way — no new `activity` row, not a flag or a returned boolean nobody reads (VI).

### C-6. The activity row's shape is pinned here; the writer that accepts it is R7's, not yet built

§5's `activity` table is fully specified in the product specification regardless of which entry builds
it — `issue_id`, `actor_id`, `type`, `field`, `from_value`, `to_value`, `comment_id`, `created_at`. For
`label_added` / `label_removed`, §5 states the shape precisely: `field` is unused, and `to_value` (add)
or `from_value` (remove) holds that one label's name, frozen at write time and truncated to 200
characters — one row per label, never one row holding a set. This feature can and does pin the exact
row each mutator writes:

```
label_added:    { issueId, actorId, type: 'label_added',   toValue: label.name }
label_removed:  { issueId, actorId, type: 'label_removed', fromValue: label.name }
```

**What this feature cannot pin**: the function signature of the writer that actually inserts the row.
R7 — Comments and activity feeds — has no child spec yet (`docs/ROADMAP.md`'s R7 row carries `—` in its
`Sub-spec` column at the time of this writing), and it is R7's own plan that will fix where that writer
lives and what it is called, the same way R6's data-model.md A-7 pinned `issue_counter`'s shape ahead of
R5's plan landing and then confirmed it once R5's plan existed. This feature's `addIssueLabel` and
`removeIssueLabel` call a placeholder import, `recordActivity(tx, { ...the shape above })`, from a path
this feature does not own and cannot create — implementation of `C-6` specifically is **blocked on R7's
plan existing**, not merely on R7's code landing. Every other decision in this document holds regardless
of when R7 arrives; this is the one that does not. See Technical Context and Complexity Tracking in
[`plan.md`](./plan.md).

**Rejected**: writing directly to the `activity` table from this feature's own mutators, bypassing a
shared writer entirely. R9's roadmap entry already commits to "written through the writer R7
establishes" for its own five column events, and R5's and R6's mutators are edited by R7 to gain the
same call rather than each inventing its own insert. A sixth caller writing the table directly would be
the second implementation of the same one-row-per-change contract, free to drift from the other five —
precisely what Principle I extracts against once a second caller exists, and R7 is that extraction
point for every entry after it, this one included.

### C-7. Each action revalidates only the path it changed

`createLabel`, `updateLabel`, `deleteLabel` revalidate `/settings/labels`. `addIssueLabel` and
`removeIssueLabel` revalidate the calling issue's own detail path, `/projects/:projectKey/issues/:issueNumber/details`
— never the labels page, which no attachment mutator touches, and never every issue's path, since only
one issue's row changed. The same convention R6's B-10 already states for its own three mutators.

### C-8. Failures are typed results; only the unexpected throws

The same shape R6's B-9 uses: a validation failure, an authorization refusal, or a named clash returns
a discriminated result the caller renders inline; a database or network failure the UI cannot name
specifically is allowed to throw and surface as the generic rejected-write toast §4 already specifies
("Only admins can manage labels" / "Only project members can label issues in Website Redesign"). No
mutator here introduces a third failure channel.

---

## D. The two surfaces

### D-1. `/settings/labels` fills a page R2 has not built yet

The same situation R6 was in for its two routes: R2's shell contract names the sidebar's **Labels**
entry and reserves the route, but the page itself does not exist until this feature builds it. This
feature's page is an admin guard followed by the list — `forbidden()` on `!isAdmin(actor)`, matching
R2's own guard-only placeholder convention (R6's D-1) rather than reinventing one.

### D-2. Create and Edit are one component, populated conditionally

§3.10 states it as the spec's own words: "Edit — the same modal, populated." `LabelFormModal` takes an
optional `label` prop; its absence is Create, its presence is Edit — one name field, one colour picker,
one submit path (C-2), and the two call sites (the page's **New label** button, each row's **Edit**)
differ only in what they pass in. This mirrors R5's own precedent of a single `EditableField` serving
five callers on the day it lands, not a rule invented for this feature.

### D-3. Delete confirms in a React Aria `AlertDialog`, and its count is real from day one

R6's D-8 built the same confirmation shape for `deleteIssue`, but with no cascade attached yet — its
own words, "states a size it has none of." This feature's confirmation has a real one from its first
release: FR-011's "It will be removed from 14 issues" is C-4's count rendered into the dialog's body,
not a placeholder waiting for a later entry to fill in.

### D-4. The label picker is one presentational component with two callers on day one

`LabelPickerField` — a multi-select control over the team's existing labels — serves the issue rail
(FR-015) and the Create issue form (FR-016) from the moment this feature lands, not a hypothetical
future second caller. This is the same shape R5's `palette-field.tsx` and `EditableField` were built
under: two call sites visible on day one is what licenses one shared presentational component under
Principle I, not a guess at a shape a second caller has not confirmed. The two callers differ only in
how a change commits:

- **The rail** (an existing issue): each toggle calls `addIssueLabel` or `removeIssueLabel` immediately,
  applied optimistically and rolled back on refusal — the same optimistic-apply convention every other
  rail control in R6 already uses.
- **Create issue** (no issue exists yet): selection is local component state, included in `createIssue`'s
  own payload at submit — nothing is written per-toggle, because there is nothing yet to attach a label
  to.

`LabelPickerField` itself commits nothing; it renders options and reports a selection. Each caller
decides what a selection change means, which is what keeps the presentational component genuinely
shared rather than shaped around one caller's commit strategy.

### D-5. The picker stays inside `src/features/labels/components/`, not promoted to `shared`

Both of `LabelPickerField`'s callers — the issue rail, the Create issue form — live inside R6's
`src/features/issues/`, reading across the feature boundary into `src/features/labels/`. That is not
the condition B-1 used to promote the palette: there, two *independent* features each needed the exact
same domain-neutral seven-value picker. Here, one feature (`issues`) needs a `labels`-domain component
to decorate its own screens, the same shape R6 already established by reading R5's project and column
data directly rather than promoting those reads to `shared`. `src/features/labels/components/label-picker-field.tsx`
exports it; R6's `issue-rail.tsx` and `create-issue-form.tsx` import it, matching the cross-feature
import pattern `AGENTS.md`'s Structure section already permits (feature code may be read by another
feature; only `src/components/ui` and genuinely feature-agnostic modules move to a shared location).

### D-6. "Manage labels" hides for non-admins at the foot of both picker instances, per the one navigation exception

`OT-UX-003`: navigation to an admin-only screen is hidden, not disabled — the one exception to
`OT-UX-002`'s disabled-with-reason rule, and the exact citation §3.10 gives the link. The check is a
client-side render condition on `actor.role`; nothing sensitive is gated behind it, since the route
itself refuses a non-admin regardless (D-1) — the hide is a wayfinding courtesy, not the enforcement.

### D-7. The labels page's skeleton sits inside the page, under `Suspense`, never in a `loading.tsx`

The same reasoning R6's D-10 already states: a segment-level `loading.tsx` sits above the page and
would turn a `403` into a streamed `200` for a non-admin before the guard runs. `/settings/labels`
resolves `isAdmin` first, then wraps only the label list's query in `Suspense`.

---

## E. Meeting change gate 1 on this feature

### E-1. Server tests assert schema constraints by attempting the violating write

The same convention R6's E-4 already established: `char_length(name) <= 200`, the seven-colour `CHECK`,
the case-insensitive uniqueness, and the composite-key idempotency are each proven by writing the
violating (or repeated) row against the real `TEST_DATABASE_URL` instance and reading the refusal (or
the silent no-op), never by a mock.

### E-2. `label` and `issue_label` join `TRUNCATED_TABLES`

`src/db/test-database.ts` gains both names in its list, in an order that respects `issue_label`'s two
foreign keys — after `issue` (R6's addition) and before nothing, since nothing this feature creates
references either table onward.

### E-3. The concurrency scenario for `addIssueLabel`'s idempotency needs two connections

The same reasoning R6's E-2 already states for `updateIssue`'s row lock: two `Promise`s racing on one
connection serialize through that connection's own query queue and never actually contend. Proving
`ON CONFLICT DO NOTHING` under real concurrency opens a second `postgres` client against
`TEST_DATABASE_URL` for the second caller.

---

## Assumptions carried forward

- **The activity writer's function signature and module path are undetermined until R7's plan lands**
  (C-6). This is the one place this plan's design could change without any fault of its own reasoning —
  once R7's plan exists, `T0xx`'s reconciliation task (mirroring R6's `T001`) confirms `recordActivity`'s
  actual shape against what this plan pinned, exactly as R6's `T001` confirmed `issue_counter` against
  R5's landed plan.
- **The palette move (B-1) is a reach-back into R5's inherited feature directory.** If R5's plan has, by
  the time this feature is implemented, already moved `palette.ts` and `palette-field.tsx` somewhere
  else (for its own reasons, or because R9 got there first), this feature's task list retargets its
  import paths rather than re-deciding where the module belongs.
