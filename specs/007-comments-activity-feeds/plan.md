# Implementation Plan: Comments and activity feeds

**Branch**: `claude/r7-feature-specifications-c07340` | **Date**: 2026-09-01 | **Spec**: [`spec.md`](./spec.md)

**Input**: Feature specification from [`specs/007-comments-activity-feeds/spec.md`](./spec.md) and
roadmap entry **R7**, whose scope boundary this plan does not widen.

## Summary

R7 gives every project and every issue a shared feed: two tables — `comment` and `activity` — one
component rendering both, one composer, one `@mention` picker, and four Server Actions. It is also the
entry that makes R5's and R6's own mutators tell the truth about their own history: seven functions
those entries already shipped as specs and plans gain one addition each, inside their own transactions,
writing through one shared function this feature builds and nothing else ever writes an `activity` row
through.

**Two decisions carry the design**, and neither is a stylistic preference.

The activity-writing primitive **lives where the table it writes lives**, in
`src/features/activity/server/`, and is imported directly by R5's and R6's server modules exactly the
way every later entry already imports R1's `publicUser` and `requireActor` — a cross-feature import of
a server-only domain function is not new here, and no promotion to `src/lib` invents a home for
something that already has an owner.

**`updateProject` gains a diff it did not have before**, and this is the one reach-back in this feature
that is not "add a call where the answer already exists." `updateIssue` already computes a full delta
for its own SET-list (R6's own plan says so explicitly), so R7's edit there is one line. `updateProject`
does not — R5's shipped contract already reads the stored row unconditionally on every call, for its
own membership check, but never compares that row against the fields it was given; it writes whatever
partial it is given with no diff. `FR-051` and `SC-003` both require knowing which named field actually
changed, so this feature adds the comparison and a `FOR UPDATE` lock on the read that already runs,
neither of which R5 needed for its own contract. It is recorded in *Complexity Tracking* below rather
than left for a reviewer to discover mid-diff.

A third fact, not a decision: **`user.feed_filter` already exists.** R1's own migration added it to the
`user` table it created, a release ahead of `FR-006`'s framing of it as this feature's column. This
feature's migration adds two tables and touches no column on `user` — research A-7 has the evidence.

Full reasoning in [`research.md`](./research.md) — twenty-nine decisions, groups A–F. The four
mutators and the shared writer in [`contracts/mutators.md`](./contracts/mutators.md); the feed, the
composer and the mention picker in [`contracts/screens.md`](./contracts/screens.md).

## Technical Context

**Precondition — entries R2, R5 and R6 have since landed.** This plan was originally written against a
tree holding R1 only. That is no longer this tree's state: `src/app/(app)` (R2's shell), and
`src/features/projects/server/` and `src/features/issues/server/` (R5's and R6's mutators, including
`createProject`, `updateProject`, `setProjectStatus`, `addProjectMember`, `removeProjectMember`,
`createIssue` and `updateIssue`) all exist with passing test suites. `src/features/labels/` (R8) has
also landed, ahead of its own roadmap dependency on this feature — nothing there is this feature's
concern. `tasks.md`'s own T001 is where this plan's own facts about R5's and R6's exact shipped shape —
most notably that `project` carries no `colour` column and that `updateProject`'s stored-row read is
already unconditional, both reflected in this plan directly — are confirmed against the code before any
later task depends on them. **Implementation is not blocked**; nothing below assumes otherwise.

**R3 is not a precondition beyond the deactivation flag.** This feature excludes deactivated accounts
from every mention list and ranked group by reading `user.deactivated_at`, a column R1's table already
carries; it needs none of R3's screens.

**Language/Version**: TypeScript 7.0.2, `strict`. No `any`, no non-null assertions, no `@ts-ignore`.

**Primary Dependencies**: Next.js 16.3.2 (App Router), React 19.2.8 with React Compiler enabled,
`react-aria-components` 1.20.0, `drizzle-orm` 0.45.2 over `postgres` 3.4.9, `uuidv7` 1.2.1, Tailwind
CSS v4 configured in CSS, Biome 2.4.2.

**Dependencies this feature installs**: none. `Popover` and `ListBox` are already in
`react-aria-components`; the feed's pagination, collapsing and mention resolution are all plain
functions over data already in hand.

**Configuration this feature changes**: none. `next.config.ts` and `vitest.config.mts` are untouched.

**Storage**: PostgreSQL 18 via Drizzle. **Two tables added** (`comment`, `activity`), **zero tables or
columns altered** — unlike R6's alteration of R5's `board_column`, this feature's two new tables carry
no composite foreign key into an inherited table, so nothing about `project` or `issue`'s own schema
changes. One migration, generated with `db:generate` and its SQL inspected before commit. Four indexes,
research A-8.

**Testing**: Vitest 4.1.11 in R1's two projects — `server` (node) for the schema constraints, the
writer, the four mutators, the seven mutator edits, and the feed and mention queries; `ui` (jsdom,
`@testing-library/react`) for every component. Persistence tests run against the real PostgreSQL
instance `TEST_DATABASE_URL` names, on a separate database. No async Server Component is rendered by a
test, following R2's and R6's own constraint (research, and R6 D-2).

**Target Platform**: self-hosted on a single box, Node.js runtime. Desktop browser only.

**Project Type**: web application — one Next.js project, no separate frontend and backend.

**Performance Goals**: none stated by the specification, and none invented. The feed's own pagination
(`FR-032`) and optimistic posting (`FR-037`) are behavioural requirements, not timing ones, per the
spec's own *Out of Scope*.

**Constraints**: every signed-in user reads every comment and every activity row; membership is never
a visibility boundary here either (`OT-AUTHZ-002`, `FR-014`) · authorship, not membership, governs a
comment's own edit and delete (`FR-016`, `FR-017`) · no activity row is ever editable or deletable by
anyone (`FR-018`) · a frozen display string is never re-resolved from a live value, and a mention token
is never frozen — both rules stated because their proximity invites conflating them (`FR-007`,
`FR-022`) · the seven mutators this feature edits must not change what R5's or R6's own acceptance
scenarios and success criteria already promised (`FR-054`, `FR-057`) · no dependency outside
`AGENTS.md`'s table (IV) · no seam built for R8, R9 or R11 beyond the one primitive `FR-011` and
`FR-012` justify today (I, III, VI).

**Scale/Scope**: one installation, one team under twenty people. 62 functional requirements (FR-001
through FR-063, FR-009 retired — spec.md Assumptions), 5 user stories, 36 acceptance scenarios,
10 edge cases, 14 success criteria, 2 tables added, 0 altered,
4 Server Actions plus 7 mutator edits, 1 internal writer, 1 shared component rendering on 2 existing
screens, 1 header edit.

**Unknowns**: none outstanding. The spec's own *Assumptions* closed nine product-level judgment calls
before this plan was written. Research adds one discovered fact rather than an assumption — A-7,
`user.feed_filter`'s existing column — and one design consequence rather than a guess — D-2,
`updateProject`'s missing diff. Neither blocks implementation; each names the one place it changes
what a plan written from the spec alone would have expected.

## Constitution Check

*GATE: passed before Phase 0, re-evaluated after Phase 1 design. Both evaluations below.*

Principles are hosted in [`AGENTS.md`](../../AGENTS.md);
[`.specify/memory/constitution.md`](../../.specify/memory/constitution.md) holds governance and the
version record (v1.0.0).

| | Principle | Assessment | Post-design |
| --- | --- | --- | --- |
| **I** | Component-Driven Architecture | One feed component renders on two call sites that exist inside this same feature's own commit (`FR-026`) — the roadmap's own §1.1 names this as the case where Principle I's precondition is met on arrival, not guessed at. The activity-writing primitive clears the same bar by a wider margin: eight call sites inside this feature alone (research B-4), before R8 or R9 exist. `comment-row.tsx` and `activity-row.tsx` stay split from `feed-row.tsx` because each carries logic the other does not, not for symmetry. | pass |
| **II** | Validated Input Boundaries | Four Server Actions, each a public server entry point, each validating shape and then value before writing. `createComment`'s `isMember` is derived from the stored issue or project, never from a client-supplied project id (`OT-AUTHZ-004`). `updateComment` and `deleteComment` authorize against the comment's own stored `author_id`. Every over-length or empty body is refused on the field, never truncated or silently accepted. | pass |
| **III** | Straightforward Over Clever | `num_nonnulls(a, b) = 1` over a hand-written boolean pair (research A-2). Mention resolution is a regex pass over known-plain text, not a parse tree — R6's markdown grammar has no reason to be reused here because `FR-010` refuses markdown in a comment body outright. Collapsing is a pure function over an already-fetched page, not a query-time window function (research F-2). No hook registry, event bus or generic dispatcher is built for R8, R9 or R11 — the writer's one signature is the whole extension surface, matching R6's own refusal of the same shape for its `updateIssue` delta. | pass |
| **IV** | Built-In Features Over Third-Party Libraries | No dependency installed. `Popover` and `ListBox` are already in the approved `react-aria-components`. `UNION ALL` and keyset pagination are PostgreSQL's own; `num_nonnulls` is built-in. | pass |
| **V** | Intention-Revealing Code Without Comments | No comments in the diff. The three places a reader will want an explanation — why `updateProject`'s read widens from conditional to unconditional, why the writer lives in `src/features/activity/` rather than `src/lib`, why a mention needs no "unknown user" fallback — are answered by [`research.md`](./research.md) D-2, B-1 and E-1, not by annotation. | pass |
| **VI** | No Dead Code | The writer's signature admits every field a future `activity.type` value might need (`field`, `fromValue`, `toValue`, `commentId`, all optional) — this is not speculative width, because every one of the seven values this feature itself writes already uses a different subset of them; nothing is added for a value R8 or R9 has not yet defined. | pass |
| **VII** | Test-First (NON-NEGOTIABLE) | Every acceptance scenario across the five user stories is a Red step written before its implementation. The structural requirements (`FR-001`…`FR-010`) are tested by asserting the database refuses the violating write or the table lacks a column, the method the spec's own preamble fixes and R6 already established. `updateProject`'s new diff is tested at its own boundary — a call whose named values match the stored row writes nothing — the same test shape `SC-018` already proved for `updateIssue`. | pass |

### Gates 1–8

| # | Gate | How it is met |
| --- | --- | --- |
| 1 | A test written first and observed failing | Each task in `tasks.md` (Phase 2, not yet generated) will pair one scenario with one implementation; the commit order is the evidence |
| 2 | Minimal implementation, then refactor green | Scoped per task. `writeActivity` does exactly what `FR-013` allows and nothing else |
| 3 | Server-side validation at every touched boundary | Principle II row above |
| 4 | No unapproved dependency | None installed |
| 5 | `npm run style-check` clean | Run as part of `npm run verify` |
| 6 | No comments, no commented-out code, no dead code | Principles V and VI rows above |
| 7 | Every changed line traces to a requirement | Each file in the structure below names the requirement that puts it there; the seven edits into R5's and R6's mutators are named in `contracts/mutators.md`'s reach-back table |
| 8 | `npm test` passes with nothing failing or skipped | Run as part of `npm run verify` |

**Re-evaluation after Phase 1.** The design added no dependency, no abstraction without its call sites
already present, and no comment. One thing it *changed* beyond what `FR-050`–`FR-058` state directly:
`updateProject`'s already-unconditional row read gains a `FOR UPDATE` lock and a diff against the
locked row, neither of which its read needed before this feature. Recorded below rather than left in
the diff.

## Project Structure

### Documentation (this feature)

```text
specs/007-comments-activity-feeds/
├── spec.md                     the feature specification
├── plan.md                     this file
├── research.md                 Phase 0 — 29 decisions, groups A–F
├── data-model.md               Phase 1 — two tables added, the reads, the DTOs, the writes
├── quickstart.md               Phase 1 — runnable walkthroughs, and what a browser cannot show
├── contracts/
│   ├── mutators.md             createComment, updateComment, deleteComment, setFeedFilter,
│   │                           writeActivity, and the seven-mutator reach-back
│   └── screens.md              Feed, Composer, MentionPicker, and the two screens they fill
├── checklists/
│   └── requirements.md         spec-quality gate — already complete, 15/15 assigned IDs traced
└── tasks.md                    Phase 2 — not created by /speckit-plan
```

### Source code (repository root)

Every path below is created or edited by this feature, and each names why it exists.

```text
src/
├── db/
│   ├── schema.ts                              EDIT — comment, activity                FR-001…FR-010
│   └── test-database.ts                       EDIT — "comment", "activity" into TRUNCATED_TABLES
└── features/
    ├── activity/
    │   ├── actions.ts                         "use server" — the four entry points
    │   ├── components/
    │   │   ├── feed.tsx                       "use client" — stream, pagination, filter
    │   │   │                                                          FR-026…FR-038
    │   │   ├── feed-row.tsx                   synchronous — dispatches on `kind`       FR-028
    │   │   ├── comment-row.tsx                synchronous — body, mentions, controls   FR-028
    │   │   ├── activity-row.tsx               synchronous — the sentence table         FR-030, FR-031
    │   │   ├── composer.tsx                   "use client" — field, mention trigger    FR-039…FR-044
    │   │   ├── mention-picker.tsx             "use client" — Popover + ListBox         FR-024, FR-025
    │   │   ├── feed-filter-toggle.tsx         "use client"                             FR-033, FR-034
    │   │   └── feed-skeleton.tsx              synchronous                              FR-060
    │   └── server/
    │       ├── write-activity.ts              the one internal writer                  FR-011…FR-013
    │       ├── create-comment.ts                                                       FR-045, FR-046
    │       ├── update-comment.ts                                                       FR-047
    │       ├── delete-comment.ts                                                       FR-048
    │       ├── feed-filter.ts                                                          FR-034
    │       ├── feed-queries.ts                listFeed, the UNION ALL + keyset page    FR-032
    │       ├── mention-queries.ts             listMentionCandidates                     FR-024
    │       ├── mention-resolve.ts             resolve @[id] tokens to display names     FR-022
    │       └── input.ts                       one parser for body                       FR-041
    ├── projects/                              EDIT (R5's) — five mutators, one screen, one header:
    │   │                                        · createProject — one created + N member_added
    │   │                                        · updateProject — new diff + one field_changed each
    │   │                                        · setProjectStatus — one archived/reopened
    │   │                                        · addProjectMember / removeProjectMember —
    │   │                                          one lookup + one member_added/member_removed each
    │   │                                                          FR-050…FR-054
    │   │                                        · project-details-screen.tsx — mounts <Feed>  FR-026
    │   │                                        · project-header.tsx — the comment count       FR-059
    └── issues/                                EDIT (R6's) — two mutators, one screen:
                                                  · createIssue — one created
                                                  · updateIssue — one field_changed per differing field
                                                                  FR-055…FR-057
                                                  · issue-detail.tsx — mounts <Feed>              FR-026

drizzle/<next>_*.sql                            NEW — generated, inspected, committed with its snapshot
                                                (the number is read off the generator; R2 through R6
                                                 may each add their own migration before this one)
```

Untouched and named so: `next.config.ts`, `vitest.config.mts`, `drizzle.config.ts`,
`src/app/layout.tsx`, `src/app/provider.tsx`, `src/app/globals.css`, `src/app/(auth)/`,
`src/features/auth/`, `proxy.ts`, `src/instrumentation.ts`, and every route file under
`src/app/(app)/` — this feature edits components R5 and R6 render inside those routes, never the
`page.tsx` files themselves.

**Structure Decision.** `AGENTS.md`'s rules, followed exactly. A new feature directory,
`src/features/activity/`, named for the table this feature's own primitive and query surface are
built around — `comment` is one row kind among several the feed renders, `activity` is the table every
other entry's mutator reaches into. `actions.ts` carries the top-level `"use server"` and is the only
module a Client Component imports this feature's server behaviour from; everything database-facing
sits under `server/`. No barrel file mixes server and client exports.

**`write-activity.ts` is imported cross-feature, by `src/features/projects/server/*.ts` and
`src/features/issues/server/*.ts`, and this is not a promotion to `src/components/shared` or
`src/lib`.** `AGENTS.md`'s promotion rule governs components; `write-activity.ts` is a server-only
domain function whose owner is the table it writes to, and every later entry already imports R1's
`publicUser` and `requireActor` the identical way — a precedent this feature follows rather than sets.

**`src/components/ui` is still not created.** `MentionPicker` is this feature's one hand-built control,
and it is hand-built precisely because `AGENTS.md` names it as the single exception — nothing here is
a second reusable primitive with two callers.

## Complexity Tracking

Three items where this feature's reach-back into inherited work goes beyond "add a call at an existing
point." Each is recorded so a reviewer meets it here rather than discovering it in the diff.

| Violation | Why needed | Simpler alternative rejected because |
| --- | --- | --- |
| **`updateProject`'s already-unconditional stored-row read gains a `FOR UPDATE` lock and a diff it did not compute before** (a reach-back that changes an inherited mutator's shape, not only its output) | `FR-051` requires one `field_changed` row per field that actually differs from what is stored, across all four of `updateProject`'s fields, and `SC-003` requires zero rows for a call that changes nothing. R5's shipped contract already reads the stored row on every call, for its own membership check, but never compares that row against the fields it was given — no earlier requirement depended on that answer. `updateIssue` already computes this for its own SET-list (R6's own plan says so), so nothing is being invented; `updateProject` simply catches up to a shape a sibling mutator already has. | *Write a `field_changed` row unconditionally whenever `updateProject` is called with a field named.* `SC-003` refuses this directly — a call that resends an unchanged value would falsify the feed with a change that did not happen. *Compute the diff without locking the row `FOR UPDATE`.* A concurrent `updateProject` on the same row could then read a stale value and write a `field_changed` row for a change that a second, interleaved write already overwrote. |
| **`addProjectMember` and `removeProjectMember` each gain one `SELECT` they did not need before** (a reach-back adding a read, not only a write) | `FR-053` requires the added or removed member's display name frozen into `to_value` or `from_value` at write time (`FR-007`). Neither mutator previously read the target user's row — each already had both halves of the `(project_id, user_id)` pair it needed for its own `INSERT` or `DELETE`. | *Freeze the user id instead of the display name, and resolve it at render time.* That is exactly the opposite of `FR-007`'s rule: a `from_value`/`to_value` is frozen precisely so a later rename does not rewrite history, which `FR-007` and `FR-022` both state as one pair of opposite, deliberate rules. |
| **`setProjectStatus`, `addProjectMember` and `removeProjectMember` each gain a `db.transaction` wrapper and an optional trailing `actorId` parameter they did not have before** (a reach-back changing three mutators' own shape, not only adding a call) | `FR-052` and `FR-053` require each write and its activity row to commit together, but all three run today as a single un-transacted statement with no actor parameter at all. `FR-054` requires R5's own test files — `project-status.test.ts`, `membership.test.ts`, which call all three with today's signature — to keep passing unmodified, so the new parameter must be optional rather than required. | *Add a required `actorId` parameter to all three.* This would break every existing call site R5's own test suite exercises, which `FR-054` forbids. *Call `writeActivity` after the mutator's own statement rather than wrapping both in one transaction.* That reopens the same partial-failure gap `FR-045`'s single-transaction rule closes for `createComment` — the status or roster change could commit while its activity row does not. |

**Not recorded as a violation:** `createProject`, `createIssue` and `updateIssue` gaining their own
`writeActivity` calls. Each is additive at a point its own inherited contract already names or a point
requiring no new read (research D-1, D-5, D-6), which is the "insert a call where the answer already
exists" shape Principle VI and Principle III both admit without comment. `createProject` already runs
inside `db.transaction`, so only the optional `actorId` parameter is new for it, not a transaction
wrapper.

## Phase status

| Phase | Output | Status |
| --- | --- | --- |
| 0 — Outline & research | [`research.md`](./research.md) | complete — 29 decisions in six groups, no unknown outstanding |
| 1 — Design & contracts | [`data-model.md`](./data-model.md), [`contracts/`](./contracts/), [`quickstart.md`](./quickstart.md) | complete |
| Constitution re-check | this file | complete — pass, three items in Complexity Tracking |
| 2 — Tasks | [`tasks.md`](./tasks.md) | complete — `/speckit-tasks` has run |
| Implementation | — | not blocked — R2, R5 and R6 have landed (Technical Context, `tasks.md` T001) |
