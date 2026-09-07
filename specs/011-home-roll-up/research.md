# Phase 0 research: Home roll-up (R12)

**Input**: [`spec.md`](./spec.md) with its clarification session closed on 2026-09-06, roadmap entry
**R12**, [`AGENTS.md`](../../AGENTS.md), and the R2, R5, R6, R7, R9, R10 and R11 code already on this
branch — every decision below was taken against the tree, not against a description of it.

**Unresolved `NEEDS CLARIFICATION`: none.** The spec carries no marker, and the five product questions
its clarification session closed are treated as settled. Nothing in this document reopens one.

Twenty-eight decisions in six groups. Each names what was chosen, why, and what was rejected.

---

## A. What R12 is allowed to be

### A-1 · Zero writes is a structural property, not a discipline

**Decision.** `src/features/home/` contains **no `actions.ts`, no module carrying `"use server"`, and
no file with a top-level `"use client"` directive.** Every component under it is a Server Component;
every navigation is a `next/link` `<Link>`; every server module is a read.

**Rationale.** FR-004, FR-043 and US5 all say Home writes nothing. The cheapest way to make that
reviewable is to make it structural: a Server Component cannot call a Server Action it does not
import, and no Server Function module exists to import. SC-009 ("exercising every element issues zero
mutations") then has a test that is a file census rather than a behavioural sweep, and gate 6's dead
code rule is not strained by a "read-only" flag nothing reads.

**Alternatives rejected.** *A client row that guards itself* — a `"use client"` mention row that
deliberately does not call `markNotificationRead` proves nothing a reader can check, and it drags the
whole subtree into the client module graph for no interaction. *Reusing R11's `NotificationRow`* — it
calls `markNotificationRead` in `onNavigate`, which FR-026 forbids outright; see C-3.

### A-2 · No migration, and therefore no index

**Decision.** `src/db/schema.ts`, `src/db/tables.ts`, `drizzle.config.ts` and every migration under
`drizzle/` are **untouched**. No index is added for any query this feature introduces.

**Rationale.** FR-004 and the roadmap's R12 row are unambiguous: "no table, no column, no migration".
An index is a migration. Two of this feature's five queries would benefit from one — `issue.assignee_id`
is a foreign key and PostgreSQL does not index the referencing side, and the cross-installation
activity union has no index supporting a global `ORDER BY created_at DESC LIMIT 20` — and both are
knowingly left unindexed. §7 puts this installation on a single box for one team under twenty people;
at that row count a sequential scan of `activity` and `comment` is not a user-visible cost, and
`AGENTS.md` says to add indexes for known query patterns only, not for imagined growth.

**Recorded as a risk rather than fixed** in [`plan.md`](./plan.md)'s *Complexity Tracking*, so a
reviewer meets it here rather than discovering it in a query plan.

**Alternatives rejected.** *Add `issue_assignee_id_idx` in a migration* — FR-004 forbids it, and the
roadmap makes "adds no migration" the distinguishing property of this entry. *Denormalize a counter
onto `user`* — a column, forbidden by the same requirement, and a write path on a read-only entry.

### A-3 · A new feature directory, not components under `src/app`

**Decision.** `src/features/home/` holds everything; `src/app/(app)/home/page.tsx` resolves the actor
and composes sections.

**Rationale.** `AGENTS.md`: "`src/app` holds routing, layouts, pages, and route handlers only. Do not
turn pages or layouts into domain modules." Every other screen in this repository already follows it.

---

## B. Reads, and the timezone

### B-1 · The due-this-week window is computed in PostgreSQL, with `current_date`

**Decision.** The window predicate is SQL: `due_date between current_date and current_date + 6`,
evaluated as a per-row boolean inside the one query that lists the viewer's assigned issues. No
JavaScript `Date` arithmetic participates in the comparison, and the browser's clock and timezone
reach nothing.

**Rationale.** `OT-DATA-004` and §5 fix it: "calendar dates are compared in the server's own timezone,
set once by the operator, so 'due this week' and overdue mean the same thing for everyone on the
installation". `current_date` is evaluated by PostgreSQL against the database session's `TimeZone` —
which *is* the server timezone the operator sets — and `issue.due_date` is already a `date`, so the
comparison is date-to-date with no instant in it. FR-008's three exclusions fall out of the predicate
for free: a null `due_date` fails `between`, an overdue date is `< current_date`, and day seven is
`current_date + 7`. SC-013 (two users in different browser timezones read the same number) is then a
property of where the comparison runs.

**Alternatives rejected.** *Compute the window in TypeScript from `new Date()`* — `new Date()` in the
Node process is an instant, and turning it into a calendar date requires choosing a timezone; the
process timezone and the database timezone are two settings that can disagree, and the requirement
names one of them. *`@internationalized/date`* — approved (it is on the table for React Aria's
DatePicker) but it would still need the operator's timezone from somewhere, and it would move the
comparison off the side of the boundary the requirement puts it on. *An `INTERVAL '6 days'` literal* —
identical meaning, more syntax; `current_date + 6` on a `date` is integer-day addition in PostgreSQL.

### B-2 · The assigned card is the assigned list, because both read one cached call

**Decision.** `listAssignedIssues(userId)` is wrapped in React's `cache()` — the same primitive
`loadActor` already uses — and is called by **both** the stat-card block and the **Assigned to you**
section. The assigned card renders `rows.length`; the due-this-week card renders
`rows.filter((row) => row.dueThisWeek).length`.

**Rationale.** FR-007 requires the card and the section to be incapable of disagreeing, and SC-002
requires that for every user and every data shape. Deriving both numbers from one array in one request
makes disagreement unrepresentable; two independent `count(*)` queries would make it merely unlikely.
`cache()` is React's own request-scoped memo — no dependency, and the repository's established
pattern.

**Alternatives rejected.** *A separate `countAssignedIssues` query* — reintroduces the divergence
FR-007 exists to forbid, and costs a second round trip. *Passing the rows down as props from a single
parent* — would force the cards and the list into one component, which FR-001 orders as two separate
surfaces and Principle I would split anyway.

### B-3 · Progress is one grouped query plus one pure function

**Decision.** `listMemberProjectsWithProgress(userId)` joins `project_member` → `project`
(`status = 'active'`) → `issue` → `board_column` and aggregates per project with
`count(*) filter (where board_column.kind = 'done')` as the numerator and
`count(*) filter (where board_column.kind <> 'canceled')` as the denominator. The percentage itself is
a **pure function**, `progressPercent(done, counted)`, in `src/features/home/progress.ts`.

**Rationale.** FR-017's formula spans two column kinds and an arbitrary number of columns of each
kind, which `filter (where ...)` expresses exactly and a per-project loop does not (SC-004, US2 s5).
Separating the arithmetic from the query is what makes FR-018 and FR-019's six edge cases —
zero denominator, all-canceled, all-done, 3/8, 199/200, one issue short — testable without a database
at all, which is the cheapest possible Red step for the rules most likely to be got wrong.

`Math.round` is the halves-up rule FR-019 asks for on non-negative input: `Math.round(37.5) === 38`
and `Math.round(99.5) === 100`. The function then applies FR-019's two endpoint clamps: a zero
denominator returns `0`, and a rounded `100` with `done < counted` returns `99`. `done === counted`
returns `100` untouched, which is the *Edge Cases* entry that forbids the clamp from firing on a
genuinely complete project.

**Alternatives rejected.** *Compute the percentage in SQL* — puts a rounding rule with two endpoint
exceptions into a `CASE` expression that no unit test can reach. *`toFixed(0)`* — rounds half to even
in some engines and returns a string. *Reading `loadProjectDetails` per project* — N+1, and it loads a
roster, a delete-refusal calculation and a column list that Home does not render.

### B-4 · **Your projects** reads membership rows, and only there

**Decision.** The query starts at `project_member` for the viewer's `user_id`. `isMember` from
`src/features/projects/server/authorization.ts` is **not** imported by this feature. The
`status = 'active'` filter appears in this query and in no other.

**Rationale.** FR-015 draws the distinction and §2 backs it: `isMember` is true for every admin, and
an admin who was never added to a project must not see it under **Your projects**. FR-014 confines the
status filter to this one section; **Assigned to you** and **Recent activity** carry no project-status
predicate, per the fourth clarification.

**Alternatives rejected.** *Filtering with `isMember`* — wrong for admins, by §2. *Reusing
`listProjectsForSidebar`* — it lists every project regardless of membership and includes archived
ones; it answers a different question.

### B-5 · **Recent activity** excludes `activity.type = 'comment'` in its own query

**Decision.** The cross-installation union is `comment` rows (all of them) `UNION ALL` `activity` rows
**where `type <> 'comment'`**, ordered `(created_at desc, id desc)` and limited to twenty.

**Rationale.** FR-029 requires each comment to occupy exactly one row and forbids the activity log's
own `comment`-type record of that same comment from rendering as a second row. `createComment` writes
both — a `comment` row and an `activity` row of type `comment` carrying its `comment_id` — so the
union must drop one side, and it must be the activity side, because the `comment` row is the one that
carries the author and the body the feed is defined around (§3.4).

**A discrepancy this uncovered, and deliberately did not fix.** `listFeed` in
`src/features/activity/server/feed-queries.ts` applies no such exclusion, so an issue's or a project's
own R7 feed returns both rows for one comment. That is R7's behaviour, and FR-044 forbids this feature
from altering any query R5–R11 delivered; SC-014 requires every existing test to pass unmodified.
**`feed-queries.ts` is not edited.** The finding is recorded in [`plan.md`](./plan.md)'s *Complexity
Tracking* as an inherited discrepancy for R7's owners, exactly as R11 recorded the inherited `clsx`
entry rather than resolving it inside another entry's diff.

**Alternatives rejected.** *Call `listFeed` per project and per issue and merge in TypeScript* — N+1
across the whole installation to produce twenty rows, and it would inherit the duplication above.
*Read `activity` alone* — FR-029 forbids it in as many words, and it would drop every comment.
*Deduplicate in TypeScript by `activity.comment_id`* — a second implementation of a rule one `WHERE`
clause states, and it would corrupt the `LIMIT 20` (twenty fetched, fewer rendered).

### B-6 · Ordering is `(created_at desc, id desc)` everywhere, and `(lower(name), key)` for projects

**Decision.** **Assigned to you**, **Mentions** and **Recent activity** order by their row's
`created_at` descending with `id` descending as the tiebreak. **Your projects** orders by
`lower(project.name)` then `project.key`.

**Rationale.** FR-036 and `OT-UX-006` require two consecutive renders with no intervening write to
agree (SC-012). Primary keys here are UUIDv7, so `id` is itself time-ordered and the tiebreak agrees
with the intent of "newest first" rather than merely being arbitrary-but-stable. `listNotifications`
and `listFeed` already order exactly this way, so **Mentions** and **Recent activity** inherit a
proven shape. **Your projects** has no "newest first" to inherit — §3.2 fixes no order for it — so it
takes the sidebar's convention (`lower(name)`, then the unique `key`), which is what a reader of this
application already expects a project list to do. Recorded as an assumption, not a requirement.

**Alternatives rejected.** *`ORDER BY created_at` alone* — a tie reshuffles between renders, which
SC-012 forbids. *Ordering projects by progress* — invents a ranking §3.2 does not state.

---

## C. Reuse, and where it stops

### C-1 · **Mentions** extends R11's query module rather than re-deriving its row

**Decision.** One new exported function, `listRecentMentions(userId, limit)`, is added to
`src/features/notifications/server/notification-queries.ts`. It reuses that module's existing private
`composeHref`, `composeTargetPath` and `composeTargetLabel` helpers and its `NotificationListItem`
type. `listNotifications` and `countUnreadNotifications` are **not modified**.

**Rationale.** FR-024 requires the Home row to match the Notifications screen's own row, and FR-025
requires the same `#comment-<id>` deep link. Those three helpers *are* that row shape. Writing a
second copy in `src/features/home/server/` would be a second implementation of a composition rule,
free to drift — the exact objection §3.2 raises against re-deriving mentions from comment bodies, one
level down. Principle I's two-call-site rule is satisfied before extraction: the helpers already have
one caller and this is the second, and they are not promoted out of the module, merely called from a
sibling function inside it.

**Alternatives rejected.** *A new module under `home/server/` duplicating href and label composition* —
two implementations of one rule. *Refactoring `listNotifications` to share a query builder with the
new function* — edits a query R11 owns for this feature's convenience (gate 7), for a saving of a few
lines. *Adding a `type` parameter to `listNotifications`* — changes an existing function's signature
and its meaning, which FR-044 forbids.

### C-2 · FR-022 is satisfied by reading `notification`, and by importing nothing from mention parsing

**Decision.** `src/features/activity/server/mention-resolve.ts`, `MENTION_TOKEN_PATTERN` and
`src/features/activity/server/mention-queries.ts` are not imported anywhere in this feature.

**Rationale.** FR-022 and §3.2 forbid re-deriving mentions from comment bodies. The absence of the
import is the requirement; a test asserting the mention row set for a viewer who was named in a body
whose notification row was already cascade-deleted (the *Edge Cases* entry) is the behavioural proof.

### C-3 · Home gets its own mention row, and R11's row is untouched

**Decision.** `src/features/home/components/mention-row.tsx` is a **Server Component** rendering a
`next/link` `<Link>`, the unread dot with its `sr-only` text equivalent, the actor, the target and the
relative time. `src/features/notifications/components/notification-row.tsx` is not edited and not
imported.

**Rationale.** R11's row is `"use client"` and calls `markNotificationRead` in its `onNavigate`
handler. FR-026 requires activating a Home row to leave the row unread and the unread card unchanged
(SC-006), so that behaviour cannot be reused, and adding a `marksRead` prop to R11's component would
put a conditional into another entry's shipped component for this feature's benefit (gate 7, FR-044).
Home's row needs no client interactivity at all once mark-read is gone, which keeps A-1 true.

**Alternatives rejected.** *A prop on R11's row* — above. *Rendering R11's row and swallowing the
action* — the action would still fire and still mark the row read.

### C-4 · The relative-time formatter is promoted to `src/lib/` at its already-confirmed second call site

**Decision.** `formatRelativeTime(instant, now)` moves to `src/lib/relative-time.ts`, and
`src/features/activity/components/comment-row.tsx` and
`src/features/notifications/components/notification-row.tsx` import it instead of declaring their own
copy. Home's two row components import the same function. **No behaviour changes and no existing test
is edited** — the moved function is byte-identical in behaviour, including its `en-US` locale and its
unit ladder.

**Rationale.** Principle I: "a pattern MUST appear at two call sites before it is extracted". That
threshold is already met in the tree today — `formatRelativeTime` exists at exactly two call sites,
`src/features/activity/components/comment-row.tsx` and
`src/features/notifications/components/notification-row.tsx`. Leaving it unextracted would put a
further copy of the same twenty lines in the tree, which a reviewer would flag under Principle I from
the other direction.

**This is a two-file reach-back into trees R7 and R11 own, and it is recorded in
[`plan.md`](./plan.md)'s *Complexity Tracking* as approved by the user.** FR-044 forbids
altering behaviour R5–R11 delivered; a pure move alters none, and both components' existing test files
pass unmodified, which SC-014 requires and which the task carrying this move must demonstrate before
the move is accepted.

**Alternatives rejected.** *A third private copy in `home/components/`* — three copies of one
formatter, and the next reader has to diff them to know whether they agree. *Leaving R7 and R11 alone
and importing nothing* — same outcome as a third copy. *Formatting relative time on the client* —
Home ships no client component (A-1), and a server-rendered relative time on a page that re-queries on
every visit is accurate to the render.

### C-5 · R7's `ActivityRow` is composed, not copied — and `collapseFeed` is not used

**Decision.** Home's activity row renders R7's `ActivityRow` for the ten non-comment activity types,
beside a target label and a relative time it supplies itself. `collapseFeed`, `filterFeedRows`,
`FeedFilterToggle`, `getFeedFilter` and `user.feed_filter` are **not imported**.

**Rationale.** `ActivityRow` is already a pure Server Component taking `actor`, `type`, `field`,
`fromValue` and `toValue` and returning one sentence; it is R7's phrasing of "what happened" and
reusing it is what FR-030 means. FR-031 forbids the five-minute collapsing (twenty rows must mean
twenty rows) and FR-032 forbids the toggle and the remembered filter, so all five of those imports are
refused by name rather than avoided by accident.

### C-6 · The greeting uses `displayName` and adds no time-of-day variation

**Decision.** `displayName(actor)` from `src/lib/display-name.ts`, rendered from the actor
`requireActor()` already returns. No "Good morning".

**Rationale.** FR-005 and `OT-UX-019`. The spec's own *Assumptions* rules out a time-of-day greeting
because it would need a second timezone decision beyond `OT-DATA-004`'s, and no source asks for one.

---

## D. The page, its frame and its states

### D-1 · Five `Suspense` boundaries, five skeletons, no `loading.tsx`

**Decision.** `page.tsx` awaits `requireActor()`, renders the greeting synchronously, then wraps the
stat-card block, **Assigned to you**, **Your projects**, **Mentions** and **Recent activity** each in
its own `<Suspense>` with its own skeleton component. No `loading.tsx` is added under
`src/app/(app)/home/`.

**Rationale.** FR-038 and `OT-UX-005` require per-section skeletons matching the layout they replace,
with no full-screen spinner and no layout shift beyond the vertical reflow below a section whose real
row count differs from the count its skeleton reserved. R3's E-3 established the reason a
`loading.tsx` is wrong here and it applies unchanged: a `loading.tsx` sits *above* the guard and would
begin streaming a `200` before `requireActor()` has had the chance to redirect, which FR-003 and US5
s4 require. Putting the boundaries below the awaited guard keeps the redirect a redirect.

Each skeleton mirrors its section's real geometry — three cards in a row, an issue-row list, a
project-row list, five mention rows, twenty activity rows — because "matching the layout it replaces"
is the requirement and a generic grey block is not it.

**Alternatives rejected.** *One boundary around the whole page* — a full-page skeleton is the
full-screen spinner FR-038 forbids in a different costume. *`loading.tsx`* — above.

### D-2 · The stat cards and **Assigned to you** are two surfaces over one cached read

**Decision.** Two `Suspense` boundaries, two components, one `cache()`d query (B-2). The card block
additionally awaits `countUnreadNotifications(actor.id)` — R11's existing unbounded count.

**Rationale.** FR-001 fixes the order of six surfaces and Principle I splits them along their
concerns. FR-009 requires the unread card to read the sidebar's number rather than the Notifications
screen's 200-row list, and `countUnreadNotifications` is exactly that function — it takes no limit and
the `(app)` layout already calls it for the sidebar, so SC-003 is two call sites of one query rather
than two implementations of one count.

### D-3 · Re-query on revisit needs no configuration

**Decision.** No cache setting, no `revalidatePath`, no `"use cache"`, no `unstable_cache`. Home is
dynamic because `requireActor()` reads `cookies()`.

**Rationale.** R3's E-4 settled this for the whole application against R2's research: a dynamic page
segment's client router-cache stale time is `0`, so a revisited screen refetches. FR-039 needs the
navigation half only — Home performs no write, so there is no post-write half to arrange. Adding a
cache directive "to be sure" is the speculative configuration Principle III rejects, and `AGENTS.md`
warns in the other direction only ("do not assume a query or `fetch` is cached").

### D-4 · FR-035 is satisfied by a component that accepts no props

**Decision.** `HomePage` declares **no** `params` and **no** `searchParams` parameter. Nothing
client-supplied reaches any query; every value comes from `requireActor()` or from stored rows.

**Rationale.** FR-035 requires every count, list and figure to be computed on the server from stored
rows, and requires this route to declare no `params`, no `searchParams` and no body, so it reads no
query, path or body value at all. A route that reads nothing from the request but its session cookie
has nothing to coerce — Next.js simply does not hand a page
its search params unless it destructures them. Writing a validator for input the route never accepts
would be dead code under Principle VI. FR-027 and SC-007 are then a property of the `WHERE` clause:
`notification.user_id = actor.id`, with `actor.id` taken from the session, and no function signature
in this feature accepts a user id from anywhere else.

**The test is behavioural, not structural**: `/home?userId=<other>` renders the caller's own numbers,
and a second signed-in user's mentions never appear (US3 s5).

### D-5 · Every empty surface is one `<p>`, and a zero card is the digit `0`

**Decision.** Each of the four sections renders a single line of muted text when its list is empty.
The three cards always render a number, including `0`.

**Rationale.** FR-040, `OT-UX-007`, US1 s6 and SC-010. `NotificationsList` already sets the precedent
in one line (`No notifications yet.`) and Home's four lines match it in shape.

### D-6 · No polling, no socket, no timer

**Decision.** Nothing in this feature calls `setInterval`, `setTimeout`, `EventSource`, `WebSocket` or
a focus listener.

**Rationale.** FR-041 and §1. `OT-OPS-008`'s 30-second re-query is the board's alone and its scope
says so. Home ships no client component at all (A-1), which is a stronger guarantee than a convention.

---

## E. Accessibility and rendering

### E-1 · Every row is a `next/link` `<Link>`, not a React Aria control

**Decision.** Issue rows, project rows, mention rows and activity rows that navigate are anchors
rendered by `next/link`. React Aria's `Link` is not used and no `RouterProvider` is added.

**Rationale.** FR-042 needs an accessible name, a visible focus indicator and keyboard operability; a
real anchor has all three natively, and `OT-UX-018` requires React Aria where behaviour must be
*reproduced*, not where the platform already provides it. R11's `NotificationRow` and R2's `Sidebar`
both already use `next/link` for exactly this, and R11's plan recorded the same decision (its E-3).
Focus visibility comes from the shared focus styling the application already applies.

**A row that does not navigate takes no interactive element at all** — the activity row for a
project-scoped event still links to that project, so in practice every rendered row navigates
somewhere.

### E-2 · The unread dot always carries text, and no state is colour-only

**Decision.** The mention row renders `<span className="sr-only">Unread</span>` beside the
`aria-hidden` dot, and reserves the same 2×2 box when the row is read so nothing shifts. The three
stat cards render a number and a text label naming what it counts.

**Rationale.** FR-023, FR-006 and `OT-UX-018`'s "never convey state or errors through colour alone".
R11's `NotificationRow` already does exactly this and Home matches it, which is what FR-024's "the
same dot" means.

### E-3 · Comment rows in **Recent activity** name the comment; they do not render its body

**Decision.** A comment in **Recent activity** renders as *actor · commented on · target · relative
time*, linked to `#comment-<id>` on the target. The comment body is **not** rendered and
`src/components/shared/markdown` is not imported.

**Rationale.** FR-030 enumerates the row's contents — actor, what happened, where, relative time — and
the spec's *Assumptions* say each cross-project row "names its project or issue key" and that "this
adds no data — every field is already on the row". The clarification's phrase "carrying its body"
describes §3.4's definition of a *feed*, which is the argument for why a comment is one row and not
two; it is not a second row-content requirement layered on FR-030. Rendering up to twenty markdown
bodies of up to 10 000 characters each would also make a bounded roll-up section unbounded in height,
which no requirement asks for and `OT-UX-005`'s "nothing shifts position" argues against.

**This is the one interpretive call in the design and it is recorded as such.** *If wrong*: the change
is confined to `activity-row.tsx` under `home/components/` plus one field in the row DTO — the query
already selects `comment.body`'s row and would simply carry it — and no query, no ordering and no
count changes.

**Alternatives rejected.** *Render the body through the shared markdown renderer* — above. *Render a
truncated body* — invents a truncation rule no source states.

---

## F. Testing

### F-1 · The four queries are tested against real PostgreSQL; the arithmetic is not

**Decision.** `listAssignedIssues`, `listMemberProjectsWithProgress`, `listRecentMentions` and
`listInstallationActivity` are tested in the `server` Vitest project against the real database that
`src/db/test-setup.ts` migrates. `progressPercent` is tested in the same project with no database at
all. The four section components and the stat cards, the five skeletons and the four row components are
tested in the `ui` project with jsdom and `@testing-library/react`.

**Rationale.** `AGENTS.md` requires persistence tests against real PostgreSQL, and every rule that
could break here is a rule of the *query*: the `filter (where kind = ...)` aggregation, the
`current_date` window in the server's timezone, the `user_id` scope, the `type <> 'comment'`
exclusion, the tie-breaking order, and the absence of a project-status filter on three of the four
sections. A mock verifies none of them. The rounding rule is the one part with no database in it and
it gets the cheapest possible test.

### F-2 · Four Red steps are easy to write wrongly, and are named in advance

1. **The due-this-week window.** A test asserting only "2" against four issues passes against an
   off-by-one that counts day seven and drops today. The Red step must place issues at
   `current_date`, `current_date + 6`, `current_date + 7` and `current_date - 1` and assert the
   **identity** of the two counted, not just the count (US1 s4).
2. **The 99% clamp.** A test asserting `progressPercent(199, 200) === 99` passes against an
   implementation that clamps everything to 99. It must be written together with
   `progressPercent(200, 200) === 100`, or the *Edge Cases* entry forbidding the clamp on a complete
   project is unprotected.
3. **The comment dedupe.** A test that inserts a `comment` row directly and asserts one row passes
   against an implementation with no exclusion at all, because no `comment`-type `activity` row
   exists. It must go through **`createComment`**, which writes both, and assert exactly one row and
   its `id` (FR-029).
4. **The read boundary.** A test asserting the viewer sees their own mentions passes against a query
   with no `WHERE user_id` at all whenever the fixture has one user. It must seed **two** users with
   mentions and assert the second user's rows are absent, for both `listRecentMentions` and the
   unread count (FR-027, SC-007, US3 s5).

### F-3 · SC-009 and SC-014 get census tests, not sampling

**Decision.** SC-009 ("zero mutations") is tested as a full row census of every table in
`src/db/tables.ts`' `ALL_TABLES` before and after rendering every section with data, not as a check
that a particular table is unchanged. SC-014 is `npm test` green with no test file under
`specs/`-covered entries R1–R11 moved, with the one carve-out FR-044 and SC-014 name: the single
`expect(result).toBeNull()` assertion in the "renders no header" case of
`src/app/(app)/home/page.test.ts` — R2's frame test, not a query or mutator R5 through R11 delivered —
is replaced with a real no-header assertion. The diff shows that and nothing else in any R1–R11 test
file.

**Rationale.** R11's F-2 established the census pattern for "no row is written" and the same reasoning
applies to a whole read-only page: a query for the row expected to be missing passes against an
implementation that wrote a different row.

### F-4 · `@react-aria/test-utils` is not installed and is not added

Keyboard order and focus behaviour are verified with explicit keyboard events, as `AGENTS.md`
requires and as every existing UI test file in this repository already does.
