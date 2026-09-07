# Implementation Plan: Home roll-up

**Branch**: `sdd/r12-final` | **Date**: 2026-09-06 | **Spec**: [`spec.md`](./spec.md)

**Input**: Feature specification from [`specs/011-home-roll-up/spec.md`](./spec.md) and roadmap entry
**R12**, whose scope boundary this plan does not widen.

## Summary

R12 is the last entry in the roadmap and the only one that **adds no table, no column, no migration,
no mutator and no Server Action**. It fills the content region of `/home` — a route R2 shipped as a
headerless frame returning `null` — with a greeting, three stat cards and four sections, all of them
reads over rows R5 through R11 already write. It installs **no dependency**, and it needs none: every
capability it uses is either already on `AGENTS.md`'s approved table or is the Web platform's own.

**Six decisions carry the design.**

1. **Read-only is structural, not a discipline.** `src/features/home/` contains no `actions.ts`, no
   module carrying `"use server"`, and **no file carrying `"use client"`** — every component is a
   Server Component and every navigation is a `next/link` anchor. SC-009's "zero mutations" is then a
   file census rather than a behavioural sweep, and FR-041's "no polling, no socket, no timer" is a
   property of a page with no client runtime at all. ([`research.md`](./research.md) A-1.)

2. **The due-this-week window is a PostgreSQL predicate, not JavaScript date arithmetic.**
   `due_date between current_date and current_date + 6`, evaluated as a per-row boolean inside the one
   query that lists the viewer's assigned issues. `current_date` resolves against the database
   session's `TimeZone` — the operator's one setting, which is exactly what `OT-DATA-004` and §5 name
   — so SC-013 ("identical for two users in different browser timezones") is a property of *where the
   comparison runs*. FR-008's three exclusions — no due date, overdue, day seven — fall out of
   `between` for free. (B-1.)

3. **The assigned card *is* the assigned list.** `listAssignedIssues(userId)` is wrapped in React's
   `cache()` — the primitive `loadActor` already uses — and both the card block and the section read
   it. The card renders `rows.length`. FR-007's "can never disagree" and SC-002's "for every user and
   every data shape" become unrepresentable rather than merely unlikely; two independent `count(*)`
   queries would have left the divergence possible. (B-2.)

4. **Progress is one grouped query plus one pure function.**
   `count(*) filter (where kind = 'done')` over `count(*) filter (where kind <> 'canceled')` in SQL —
   which handles two `done`-kind columns without a loop (US2 s5) — and `progressPercent(done, counted)`
   in a module with no database, where `Math.round` gives FR-019's halves-up and two explicit clamps
   give its two endpoints. Six of the spec's hardest cases (0/0, all-canceled, 3/8, 199/200, 200/200,
   0/5) get the cheapest possible Red step. (B-3.)

5. **Recent activity excludes `activity.type = 'comment'` in its own query — and this uncovered an
   inherited discrepancy that is recorded, not fixed.** `createComment` writes both a `comment` row
   and a `comment`-type `activity` row, so the cross-installation union must drop one side to satisfy
   FR-029; it drops the activity side, because the `comment` row is the one §3.4's feed is defined
   around. R7's own `listFeed` applies **no such exclusion**, so an issue's feed returns both rows
   today. FR-044 and SC-014 forbid this feature from touching it. `feed-queries.ts` is **not edited**
   and the finding is carried in *Complexity Tracking* for R7's owners. (B-5.)

6. **Mentions extends R11's query module rather than re-deriving R11's row.** One added export,
   `listRecentMentions(userId, limit)`, reusing that module's private `composeHref` and
   `composeTargetLabel` helpers and its `NotificationListItem` type; `listNotifications` and
   `countUnreadNotifications` are byte-identical. Writing a second href-and-label composition in
   `home/server/` would be the same objection §3.2 raises against re-deriving mentions from comment
   bodies, one level down. R11's **row component** is a different matter and is *not* reused: it calls
   `markNotificationRead` on navigate, which FR-026 forbids here. (C-1, C-3.)

Full reasoning in [`research.md`](./research.md) — 28 decisions in six groups. The read model, the
read boundary and the four query shapes in [`data-model.md`](./data-model.md); the function signatures,
the nine functions refused by name and the gate-3 boundary table in
[`contracts/queries.md`](./contracts/queries.md); the six surfaces, their skeletons and their row
shapes in [`contracts/screens.md`](./contracts/screens.md); eighteen walkthroughs in
[`quickstart.md`](./quickstart.md).

## Technical Context

**Precondition — R1, R2, R5, R6, R7, R9, R10 and R11 are implemented on this branch, not merely
planned.** Everything this feature builds on was read, not assumed:

- **R1** — `requireActor()` / `loadActor` (`cache()`d, reads `cookies()`, redirects to `/signin`);
  `publicUser` in `projections.ts`; `src/lib/display-name.ts`; `src/db/tables.ts`' `ALL_TABLES`;
  `src/db/test-setup.ts` and the two-project Vitest configuration.
- **R2** — `src/app/(app)/home/page.tsx`, which today awaits `requireActor()` and returns `null`, and
  its three existing tests; `(app)/layout.tsx`'s actor-and-projects load and its
  `countUnreadNotifications` call for the sidebar; `AppShell`, `Sidebar`, `ScreenHeader` — **none of
  which this feature edits**.
- **R5 / R9** — `project`, `project_member`, `board_column.kind` with its five seeded rows;
  `hasProjectMemberRow` and `isMember`, the latter deliberately not called.
- **R6** — `issue` with `assignee_id` and `due_date` (a `date`, not a timestamp);
  `formatIssueKey(projectKey, number)`; the `/projects/<KEY>/issues/<number>/details` route.
- **R7** — `comment` and `activity`; `writeActivity`'s eleven types; `listFeed`'s three-step
  union-then-hydrate shape, which this feature's cross-installation query mirrors; `ActivityRow`'s
  `buildSentence`, composed rather than copied; `collapseFeed` and `filterFeedRows`, refused by name;
  the `#comment-<id>` anchor in `comment-row.tsx`.
- **R11** — `notification`; `notification-queries.ts` with `listNotifications` (`LIMIT 200`),
  `countUnreadNotifications` (unbounded) and its three private row-composition helpers;
  `NotificationRow`'s unread dot with its `sr-only` text equivalent, and its `markNotificationRead`
  call, which is why Home cannot reuse it.

**Consequently there is no blocked requirement, no placeholder import and no NEEDS CLARIFICATION.**
The spec's clarification session closed five product questions on 2026-09-06 and this plan treats all
five as settled.

**Language/Version**: TypeScript 7.0.2, `strict`. No `any`, no non-null assertions, no `@ts-ignore`,
no unsafe casts.

**Primary Dependencies**: Next.js 16.3.2 (App Router), React 19.2.8 with React Compiler enabled
(`babel-plugin-react-compiler` 1.0.0 — so no hand-written `useMemo`, `useCallback` or `memo`, of which
this feature has none anyway), `drizzle-orm` 0.45.2 over `postgres` 3.4.9, Tailwind CSS v4 configured
in CSS, Biome 2.4.2, Vitest 4.1.11.

**Dependencies this feature installs**: **none**, and FR-045 says so. `drizzle-orm` for the four
queries; `next/link` and React's `cache()` and `Suspense` for the page; `Intl.RelativeTimeFormat` —
the Web platform's own, already used by R7 and R11 — for every relative time.
**`react-aria-components` is not imported by this feature at all**, and that is not an oversight:
`OT-UX-018` requires React Aria where interaction behaviour must be *reproduced*, and this page's only
interactive elements are links, for which the platform already supplies the accessible name, the focus
ring and the keyboard operability (E-1). No `RouterProvider` is added.

**Dependencies this feature deliberately refuses**, each absent from `AGENTS.md`'s table and therefore
barred by Principle IV without a recorded amendment: every date library — `date-fns`, `dayjs`,
`luxon`, `moment-timezone` — because the one date comparison runs in PostgreSQL (B-1) and the one
relative time is `Intl.RelativeTimeFormat`; every charting or sparkline library, because the progress
figure is a percentage rendered as text; every data-fetching or cache library — `swr`,
`@tanstack/react-query` — because the page is a Server Component that re-queries by default (D-3);
`@react-aria/test-utils`, which `AGENTS.md` names explicitly as needing approval.

**Configuration this feature changes**: **none.** `package.json`, `next.config.ts`,
`vitest.config.mts`, `tsconfig.json`, `biome.json`, `drizzle.config.ts`, `src/db/schema.ts`,
`src/db/tables.ts` and every file under `drizzle/` are untouched.

**Storage**: PostgreSQL 18 via Drizzle, **read only**. No table, column, constraint, index or
migration is added (FR-004). Two query patterns are knowingly left unindexed — `issue.assignee_id`
(PostgreSQL does not index a foreign key's referencing side) and the global
`ORDER BY created_at DESC LIMIT 20` over the activity/comment union — because an index is a migration
and FR-004 forbids one. §7 puts this installation on a single box for one team under twenty people.
Recorded in *Complexity Tracking* rather than silently accepted. See
[`data-model.md`](./data-model.md).

**Testing**: Vitest in the two projects the repository already configures — `server` (node,
`fileParallelism: false`, real PostgreSQL migrated through `src/db/test-setup.ts`) for the four
queries, the read boundary, the timezone window, the comment dedupe, the ordering ties and the
zero-mutation census; `ui` (jsdom, `@testing-library/react`) for the page, the four sections and the stat
cards, the five skeletons and the four row components. The rounding rule is tested with no database at all.
Persistence tests run against real PostgreSQL because every rule that can break here is a rule of the
*query* — a `filter (where ...)` aggregate, a `current_date` comparison, a `WHERE user_id`, a
`type <> 'comment'` exclusion — and a mock verifies none of them. Four easily-mis-written Red steps
are named in advance in [`research.md`](./research.md) F-2.

**Target Platform**: self-hosted on a single box, Node.js runtime, desktop browser only. No responsive
layout and no breakpoint is introduced.

**Project Type**: web application — one Next.js project, no separate frontend and backend.

**Performance Goals**: none stated by the specification and none invented. What the design fixes
instead: four queries and one count per page load, no N+1 anywhere (the cross-installation activity
read is union-then-hydrate, not a `listFeed` call per project); the assigned list is read once per
request through `cache()` however many surfaces consume it; and no request is issued after the page
has painted, ever.

**Constraints**: Home writes nothing, and has no module that could (FR-004, FR-043, SC-009) ·
notifications are the system's one row-level read rule and this feature adds no second one (FR-027,
`OT-AUTHZ-003`) · everything else is readable by every signed-in user, so **Recent activity** carries
no membership filter and **Assigned to you** no project-status filter (FR-012, FR-034, `OT-AUTHZ-002`)
· `status = 'active'` appears in exactly one query (FR-014) · calendar comparison in the server's
timezone, never the browser's (FR-008, `OT-DATA-004`) · the card and the section it heads cannot
disagree (FR-007) · a zero denominator reads 0% and an incomplete project never reads 100%
(FR-018, FR-019) · mentions come from `notification`, never from comment bodies (FR-022) · activating
a mention row marks nothing read (FR-026) · one row per comment (FR-029) · no collapsing, no toggle,
no pagination (FR-031…FR-033) · no header, and the shell is not altered (FR-002) · per-section
skeletons, no full-screen spinner, no layout shift (FR-038) · one quiet line per empty surface
(FR-040) · no polling, socket or timer (FR-041) · every row keyboard-operable with a visible focus
indicator (FR-042) · no dependency outside `AGENTS.md`'s table (FR-045, IV) · every R1–R11 test passes
unmodified (FR-044, SC-014).

**Scale/Scope**: one installation, one team under twenty people. 45 functional requirements, 5 user
stories, 27 acceptance scenarios, 14 edge cases, 14 success criteria. **0 new tables, 0 migrations,
0 mutators, 0 Server Actions, 0 client components.** 1 route file replaced, 4 new server query
functions (3 new modules plus 1 added export), 1 pure function, ~14 new components, and **4 edited
files outside this feature's own directory**, all four recorded below.

**Unknowns**: **none outstanding.** One interpretive call is recorded rather than left implicit —
whether **Recent activity** renders a comment's body (E-3). The design says it does not, on FR-030's
enumeration of the row's contents; if a reviewer disagrees the change is confined to one component and
one DTO field, and no query, ordering or count moves.

## Constitution Check

*GATE: evaluated before Phase 0 and re-evaluated against the completed Phase 1 design. Both land on
the same row — Phase 1 raised no principle question Phase 0 had not already settled. **Result: pass**,
with three items in Complexity Tracking and one inherited discrepancy recorded below them.*

Principles are hosted in [`AGENTS.md`](../../AGENTS.md);
[`.specify/memory/constitution.md`](../../.specify/memory/constitution.md) holds governance and the
version record (v1.0.0), which this plan does not amend.

| | Principle | Assessment |
| --- | --- | --- |
| **I** | Component-Driven Architecture | Six surfaces, six components, each owning one concern, plus one row component and one skeleton per list — the shape `NotificationsList` / `NotificationRow` / `NotificationsSkeleton` already established. The one extraction this feature performs, `formatRelativeTime` into `src/lib/`, is made at its **already-confirmed second** call site, not speculatively (C-4). What is *not* extracted is as deliberate: no shared "roll-up section" wrapper is factored out of four sections that differ in their row shapes; no shared "stat card" abstraction beyond the three cards' own component, which has one call site; `src/components/ui/` is still not created. R7's `ActivityRow` is **composed** rather than reimplemented, and R11's `NotificationListItem` and its composition helpers are **called** rather than copied. |
| **II** | Validated Input Boundaries | This page accepts no client input at all. `HomePage` declares no `params` and no `searchParams`, so there is nothing to coerce and nothing to validate — writing a validator for input the route never accepts would be dead code under VI (D-4). Every user id comes from `requireActor()`; no exported signature in this feature accepts one from anywhere else. The two notification reads carry `user_id = actor.id` inside the `WHERE`, which makes SC-007 a property of the statement. `limit` on the activity query is a module constant, never a request value. The gate-3 boundary table is [`contracts/queries.md`](./contracts/queries.md) §4. |
| **III** | Straightforward Over Clever | The date window is one SQL predicate, not a timezone library. The progress numerator and denominator are two `filter (where ...)` aggregates, not a per-project loop. The comment dedupe is one `WHERE` clause, not a TypeScript pass over the results — which would also have corrupted the `LIMIT 20`. Re-query on revisit is the framework default and **no cache configuration is added to "make sure"** (D-3). The rounding rule is `Math.round` plus two named clamps. |
| **IV** | Built-In Features Over Third-Party Libraries | **Zero new dependencies**, and FR-045 says so outright. `Intl.RelativeTimeFormat` and `next/link` cover the two places a library is usually reached for. Four categories are refused **by name** in Technical Context rather than silently avoided, so a reviewer can see the decision was made. The inherited `clsx` discrepancy R11 recorded is unchanged and untouched by this feature; it is restated below so gate 4 on this diff is not confused by it. |
| **V** | Intention-Revealing Code Without Comments | No comments in the diff. The five places a reader will want an explanation — why the date comparison is in SQL, why the assigned list is `cache()`d, why `activity.type = 'comment'` is excluded here but not in `listFeed`, why R11's row is not reused, why no React Aria component appears — are answered by [`research.md`](./research.md) B-1, B-2, B-5, C-3 and E-1 and by the contracts, not by annotation. Names carry the rest: `listAssignedIssues`, `listMemberProjectsWithProgress`, `listInstallationActivity`, `listRecentMentions`, `progressPercent`, `dueThisWeek`. |
| **VI** | No Dead Code | The largest single application is the **absence of a validator** for input the route cannot receive (D-4). The DTOs carry only what a surface renders: `AssignedIssueRow` has `dueThisWeek` and no `dueDate`, because no surface shows the date; `ProjectProgressRow` has `done` and `counted` and no `percent`, because the percentage is a function; `InstallationActivityRow` has no comment body (E-3). No "read-only" flag, no unused `limit` parameter, no seam left for a later entry — **there is no later entry.** |
| **VII** | Test-First (NON-NEGOTIABLE) | All 27 acceptance scenarios are carried by a Red step written before its implementation, sequenced in `tasks.md`. Four Red steps are named in advance because they are easy to get wrong (F-2): the due-window test must assert the **identity** of the two counted issues, not just the count, or an off-by-one passes; the 99% clamp test must be written together with the 200/200 case, or a clamp-everything implementation passes; the dedupe test must go through **`createComment`**, or an implementation with no exclusion passes; and the read-boundary test must seed **two** users, or a query with no `WHERE user_id` passes. SC-009 is a full `ALL_TABLES` census, not a spot check (F-3). |

### Gates 1–8

| # | Gate | How it is met |
| --- | --- | --- |
| 1 | A test written first and observed failing | Each task in `tasks.md` pairs one scenario with one implementation; the commit order is the evidence. [`research.md`](./research.md) F-2 fixes what the four subtlest Red steps are and why a passing-first-run test would not count |
| 2 | Minimal implementation, then refactor green | Scoped per task. Each query does no more than its row in [`contracts/queries.md`](./contracts/queries.md) §1 |
| 3 | Server-side validation at every touched boundary | The Principle II row above and [`contracts/queries.md`](./contracts/queries.md) §4. The page accepts no client input; the two notification reads are scoped inside the `WHERE` from the session |
| 4 | No unapproved dependency | None installed; `package.json` is unchanged. Four categories refused by name in Technical Context. The inherited `clsx` discrepancy is restated below, untouched |
| 5 | `npm run style-check` clean | Run as part of `npm run verify` |
| 6 | No comments, no commented-out code, no dead code | The Principles V and VI rows above |
| 7 | Every changed line traces to a requirement | Each path in Project Structure names the requirement putting it there. The four edits to files other entries own are named in Complexity Tracking, not left for the diff |
| 8 | `npm test` passes with nothing failing or skipped | Run as part of `npm run verify`. `--passWithNoTests` means a green run is not itself evidence of VII — the commit order is. SC-014 additionally requires that no R1–R11 test file move, with the one carve-out FR-044 and SC-014 name: the single `expect(result).toBeNull()` assertion in the "renders no header" case of `src/app/(app)/home/page.test.ts` — R2's frame test — is replaced with a real no-header assertion, and nothing else in that file or any other R1–R11 test file changes |

## Project Structure

### Documentation (this feature)

```text
specs/011-home-roll-up/
├── spec.md                     the feature specification (clarification closed 2026-09-06)
├── plan.md                     this file
├── research.md                 Phase 0 — 22 decisions, six groups
├── data-model.md               Phase 1 — the read model, the read boundary, the four query shapes
├── quickstart.md               Phase 1 — 18 walkthroughs, and what a browser cannot show
├── contracts/
│   ├── queries.md              the five read functions, the nine refused by name, the gate-3 table
│   └── screens.md              the six surfaces, their skeletons, their row shapes, a11y
├── checklists/requirements.md  spec-quality gate
└── tasks.md                    Phase 2 output (/speckit-tasks — NOT created by this command)
```

### Source code (repository root)

Every path is created or edited by this feature, and each names why it exists.

```text
src/
├── app/(app)/home/
│   ├── page.tsx                          EDIT — the `return null` body is replaced by the
│                                           greeting and five Suspense boundaries; the
│                                           requireActor() call and the absence of a header
│                                           are kept exactly as R2 delivered them
│                                                   FR-001…FR-003, FR-005, FR-038
│   └── page.test.ts                      EDIT — R2's frame test; the single
│                                           expect(result).toBeNull() assertion in the
│                                           "renders no header" case becomes a real
│                                           no-header assertion, the carve-out FR-044 and
│                                           SC-014 name; nothing else in the file moves
│                                                   FR-001, FR-002, FR-044, SC-014
├── features/home/                        NEW — the feature; it owns no table
│   ├── progress.ts                       NEW — progressPercent(done, counted); no database
│   │                                                   FR-017, FR-018, FR-019
│   ├── server/
│   │   ├── assigned-queries.ts           NEW — listAssignedIssues, cache()d; the SQL
│   │   │                                   due-this-week predicate
│   │   │                                           FR-007, FR-008, FR-010…FR-012, FR-036
│   │   ├── project-queries.ts            NEW — listMemberProjectsWithProgress; the two
│   │   │                                   filtered aggregates; the only status filter
│   │   │                                           FR-014…FR-017, FR-020, FR-036
│   │   └── activity-queries.ts           NEW — listInstallationActivity; the union with
│   │                                       type <> 'comment', then actor and target hydration
│   │                                               FR-028…FR-031, FR-034, FR-036
│   └── components/
│       ├── stat-cards.tsx                NEW — three cards, each a number and a text label
│       │                                               FR-006…FR-009
│       ├── stat-cards-skeleton.tsx       NEW                                        FR-038
│       ├── assigned-section.tsx          NEW — the list and its one quiet line
│       │                                               FR-010, FR-040
│       ├── assigned-issue-row.tsx        NEW — key, title, project; links to the issue
│       │                                               FR-011, FR-013, FR-042
│       ├── assigned-skeleton.tsx         NEW — three rows                            FR-038
│       ├── projects-section.tsx          NEW                              FR-014, FR-040
│       ├── project-progress-row.tsx      NEW — name, status, percentage      FR-016, FR-019
│       ├── projects-skeleton.tsx         NEW — three rows                            FR-038
│       ├── mentions-section.tsx          NEW                              FR-021, FR-040
│       ├── mention-row.tsx               NEW — Server Component; the dot with its text
│       │                                   equivalent; NO mark-read
│       │                                       FR-023…FR-026, FR-042
│       ├── mentions-skeleton.tsx         NEW — five rows                             FR-038
│       ├── activity-section.tsx          NEW — no collapsing, no toggle, no page control
│       │                                       FR-031…FR-033, FR-040
│       ├── activity-row.tsx              NEW — composes R7's ActivityRow beside target
│       │                                   and relative time                FR-029, FR-030
│       └── activity-skeleton.tsx         NEW — twenty rows                           FR-038
├── features/notifications/server/
│   └── notification-queries.ts           EDIT — one added export, listRecentMentions,
│                                           reusing the module's own row-composition
│                                           helpers; the two existing functions unchanged
│                                                   FR-021, FR-022, FR-024, FR-025, FR-027
├── lib/
│   └── relative-time.ts                  NEW — formatRelativeTime, moved from the two
│                                           components below at its confirmed second call site
│                                                   FR-024, FR-030 · Principle I
├── features/activity/components/
│   └── comment-row.tsx                   EDIT — imports the moved formatter; behaviour
│                                           byte-identical, existing tests unmodified   C-4
└── features/notifications/components/
    └── notification-row.tsx              EDIT — the same one-line import swap          C-4
```

Untouched and named so, because a reviewer could reasonably expect otherwise:

- **`src/db/schema.ts`, `src/db/tables.ts`, `drizzle.config.ts` and every migration** — FR-004. This
  is the one entry in the roadmap that adds none, and no index either (A-2).
- **`src/app/(app)/layout.tsx`, `app-shell.tsx`, `sidebar.tsx`, `screen-header.tsx`** — FR-002. Home
  adds nothing to the shell and reuses no header; the sidebar's unread count stays R11's, and Home's
  unread **card** calls the same query rather than threading a prop.
- **`src/features/activity/server/feed-queries.ts`** — FR-044. `listFeed` is not edited, not
  parameterized and not called. Its comment duplication is R7's and is recorded below (B-5).
- **`src/features/activity/components/feed.tsx`, `collapse.ts`, `feed-filter-toggle.tsx`,
  `feed-filter.ts`** — FR-031 and FR-032 forbid collapsing, the toggle and `user.feed_filter`.
- **`src/features/notifications/server/mark-read.ts` and `src/features/notifications/actions.ts`** —
  FR-026 and FR-043. Home cannot mark anything read, and imports nothing that could.
- **`src/features/projects/server/authorization.ts`** — `isMember` is deliberately not called;
  **Your projects** reads membership rows (FR-015, B-4).
- **`src/features/activity/server/mention-resolve.ts` and `mention-queries.ts`** — FR-022. Mentions
  come from the `notification` table.
- **`src/components/shared/markdown/`** — no comment body is rendered on Home (E-3).
- `package.json`, `next.config.ts`, `vitest.config.mts`, `tsconfig.json`, `biome.json` ·
  `src/app/provider.tsx` (no `RouterProvider`) · `src/components/ui/` (still not created) · every
  mutator in the repository, without exception.

**One edit to `docs/ROADMAP.md`**, following the convention every earlier row already follows: R12's
`Sub-spec` cell points at `specs/011-home-roll-up/`. `Status` stays `planned`; **no version is bumped
and no history or status-log row is added**, so the repository's no-history rule holds. (The working
tree already carries this edit.)

**Structure Decision.** `AGENTS.md`'s rules, followed exactly. `src/app` gains no domain module — the
route resolves the actor, renders a greeting and composes five Suspense boundaries. All behaviour
lives under `src/features/home/`, with everything touching the database in a `server/` directory
carrying `server-only` transitively through `@/db`. No barrel file mixes server and client exports —
there are no client exports. Three structural calls worth stating, because a reviewer could reasonably
expect the other answer:

- **`listRecentMentions` lives in `src/features/notifications/server/`, not in `home/server/`.** It
  reads the `notification` table, which R11's feature owns, and it reuses that module's private row
  composition. Splitting one table's read surface across two features to keep this feature's directory
  tidy is the wrong trade; the precedent is `writeActivity`, which lives in `activity/server/` and is
  imported by five files across three other features.
- **`progress.ts` sits at the feature root, not under `server/`.** It touches no database and imports
  nothing; putting it under `server/` would imply a boundary it does not have and would stop the UI
  test from using it.
- **The four sections are four components, not one parameterized `<Section>`.** Their row shapes
  differ in every field; a shared wrapper would be an abstraction extracted at its first call site (I).

## Complexity Tracking

Four places this design reaches into work another entry owns, and one thing that looks like an
omission and is not. Each is recorded so a reviewer meets it here rather than discovering it in the
diff (gate 7).

| Violation | Why needed | Simpler alternative rejected because |
| --- | --- | --- |
| **`src/features/notifications/server/notification-queries.ts` gains one exported function.** R11 owns this module. The edit is purely additive: `listNotifications` and `countUnreadNotifications` are byte-identical and their tests pass unmodified. | FR-024 requires Home's mention row to match the Notifications screen's own row, and FR-025 requires the same `#comment-<id>` deep link. That row shape *is* this module's three private composition helpers. Calling them from a sibling function is one implementation of one rule. | *A new module under `home/server/` duplicating the href and label composition* — two implementations of one composition rule, free to drift, which is the exact objection §3.2 raises against re-deriving mentions from comment bodies. *Adding a `type` filter parameter to `listNotifications`* — changes an existing function's signature and meaning, which FR-044 forbids. *Calling `listNotifications` and filtering in TypeScript* — its `LIMIT 200` is applied before any type filter, so a viewer with 200 recent non-mention notifications would see an empty **Mentions** section. |
| **`formatRelativeTime` moves to `src/lib/relative-time.ts`, editing one R7 component and one R11 component.** Both edits are a one-line import swap; the function's behaviour, its `en-US` locale and its unit ladder are unchanged, and neither component's existing test file is touched. | Principle I extracts at the **second confirmed** call site, and that threshold is already met today: `formatRelativeTime` exists at exactly two call sites in the tree, `src/features/activity/components/comment-row.tsx` and `src/features/notifications/components/notification-row.tsx`. Leaving it would put a further copy of the same twenty lines in the tree, which a reviewer would flag under Principle I from the other direction. | *A third private copy in `home/components/`* — three copies of one formatter that a later reader must diff to know whether they agree. *Import R11's component's copy* — it is module-private and the component is `"use client"`, which would pull Home's server-rendered rows into the client graph. **This edit is approved by the user**: it is the only change in this feature to a file another entry owns for a reason other than a requirement naming that file, and the task carrying it must show both components' existing suites green and unmodified before it is accepted. |
| **`src/app/(app)/home/page.test.ts` loses one assertion.** R2 owns this file. The single `expect(result).toBeNull()` in its "renders no header" case is replaced with a real no-header assertion; every other case, and every other R1–R11 test file, is untouched. | FR-001 requires the page to render six surfaces, so a test asserting the page renders `null` cannot survive the feature that fills it. FR-044 and SC-014 carve this one assertion out by name — it is R2's frame test, not a query or mutator R5 through R11 delivered. | *Leave the assertion and let it fail* — gate 8 forbids a failing test. *Delete the "renders no header" case* — FR-002 still requires no header, and deleting the case would drop the only coverage of it. *Rewrite the file* — the carve-out is one assertion wide and anything more would be the alteration FR-044 forbids. |
| **Two query patterns are knowingly left unindexed** — `issue.assignee_id`, and the global `created_at DESC LIMIT 20` over the `comment` ∪ `activity` union. | FR-004 and the roadmap's R12 row forbid a migration, and an index is a migration. This is the one entry in the roadmap defined by adding none. | *Add the two indexes anyway* — contradicts FR-004 and the roadmap boundary. *Bound the activity read by a recency window to help the planner* — invents a rule §3.2 does not state and would make "the 20 most recent" false near a quiet period. **Accepted with its cost stated**: §7 puts this on a single box for one team under twenty people. If a later measurement shows it matters, the fix is its own change with its own approval, not a widening of this one. |

**Not recorded as a violation, because it is not one — but a reviewer will ask.** R7's `listFeed`
returns **two** rows for one comment (the `comment` row and `createComment`'s `comment`-type
`activity` row), and this feature's own cross-installation query excludes the second. The two are
therefore inconsistent, and this feature does not reconcile them: FR-044 forbids altering any query
R5–R11 delivered and SC-014 requires every existing test to pass unmodified. `feed-queries.ts` is not
edited. **The finding is real and belongs to R7's owners**; it is recorded here so it is not lost, in
the same spirit as R11's inherited-discrepancy note, and no task in this feature acts on it.

**One inherited discrepancy, restated rather than fixed.** `package.json` carries `clsx@^2.1.1` as a
runtime dependency and it is not on `AGENTS.md`'s approved table, which that file calls "the complete
set". It predates R11, which recorded it, and this feature neither adds, removes nor relies on it. It
is restated so a reviewer applying gate 4 to this diff knows the discrepancy is inherited. **Resolving
it is not this feature's work and no task here does it.**

## Explicitly out of scope

Named so no task claims them: **any write at all** — no mutator, no Server Action, no form, no drag
(FR-004) · **marking a notification read from Home**, individually or in bulk (FR-026, FR-043) · **a
header on Home** (FR-002) · **the Comments only / All activity toggle and `user.feed_filter`**
(FR-032) · **pagination, "load more" and infinite scroll** on any section (FR-033) · **archived
projects under Your projects** (FR-014) · **enforcing invariant 14**, which stays `deleteColumn`'s and
entry R9's — reading a column kind is not guarding it (FR-020) · **live push, sockets, polling and
real-time collaboration** (FR-041) · **a route that shows another user's roll-up** — none exists and
none is added (FR-027) · **fixing R7's duplicate comment row in `listFeed`** (FR-044, above) ·
**adding an index for either unindexed pattern** (FR-004, above).
