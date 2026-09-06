# Implementation Plan: Notifications and email

**Branch**: `sdd/r11` | **Date**: 2026-09-06 | **Spec**: [`spec.md`](./spec.md)

**Input**: Feature specification from [`specs/010-notifications-email/spec.md`](./spec.md) and roadmap
entry **R11**, whose scope boundary this plan does not widen.

## Summary

R11 adds the sixteenth and last table of the data model, renders `/notifications` — a route that
answers "This doesn't exist" today — puts an unread count in R2's sidebar, adds two Server Actions,
reaches back into **five** mutators R6, R7 and R10 already shipped, and hangs a mail retry sweep off
the one interval timer R1 already runs. It installs **no dependency**: `nodemailer`, the timer, the
mail helper, `uuidv7`, `drizzle-orm` and `react-aria-components` are all already here and already
approved.

**Five decisions carry the design, and four of them came from reading the tree rather than the spec.**

1. **The three delete cascades need no code at all.** The spec, the roadmap and §4 all describe "the
   `notification` arm of the §4 cascades added to `deleteProject`, `deleteIssue` and `deleteComment`",
   and the correct implementation of that sentence is **three foreign keys on the new table**, each
   `ON DELETE CASCADE`. Every `mention` and `comment` row already carries its comment's own target
   (FR-046, FR-049), so an issue delete reaches its comments' notifications twice over; all three
   deletes already run in one transaction, so FR-061's "no intermediate moment" is structural. An
   explicit `tx.delete(notification)` in any of the three would be dead code under Principle VI —
   removing it would change nothing observable — and in two of the three it would be *wrong* unless it
   replicated the transitive closure by hand. `deleteProject`, `deleteIssue` and `deleteComment` are
   **not edited**. Story 7's tests are written all the same, through the real mutators, and they are
   the **regression proof** over foreign keys that already shipped — Phase 9 carries no Red step of
   its own, because gate 1 for this behaviour was discharged in Phase 2, where T005 was written first
   and observed failing against T006's first step. ([`research.md`](./research.md) C-1.)

2. **`send_attempts` is the one deliberate widening of §5, and it is unavoidable.** `OT-OPS-002`
   bounds retries at three; deriving that from wall-clock alone gives twelve attempts (the timer fires
   every five minutes inside an hour-long window) or none after a restart, and no third answer. The
   column counts every attempt including the immediate one, defaults to 0, reads 1 once the immediate
   send has *returned*, and stops the sweep at 4. **It reaches no DTO, no response and no component**,
   and that absence is a test, not a promise. (A-2, [`data-model.md`](./data-model.md) §1.)

3. **The recipient writer is `writeActivity`'s shape, and its abstraction is confirmed before it
   exists.** `write-notifications.ts` exports three `(tx, params) => Promise<string[]>` functions —
   the exact form `src/features/activity/server/write-activity.ts` already exports and that R5, R6,
   R7, R9 and R10 already call inside their own transactions. Principle I's two-call-site rule is
   satisfied in advance: the assignment writer has **three** call sites FR-050 names, the mention
   parsing has two. Nothing is extracted at a first call site. (B-1.)

4. **Mail leaves the mutator through a `void`-returning dispatch, and the ids leave the transaction
   through a closure variable.** `dispatchNotificationMail(ids): void` cannot be usefully awaited, so
   SC-013 — "response time indistinguishable from the same write with mail disabled" — is a property
   of the type rather than of caller discipline. And the ids reach it through a `let` assigned inside
   the transaction and read after it, because the spec's *Out of Scope* forbids changing these five
   mutators' **return shapes**, which five widened result types would do across twenty-odd existing
   test files. (B-5, D-2.)

5. **One line joins the sweep to R1's timer.** `sweep()` in `src/features/auth/server/sweep.ts` gains
   `await sweepNotificationMail(now)`. `startSweep`, its interval, its `unref`, its `SIGTERM` handler
   and `bootstrap.ts` are untouched, so `setInterval` still appears exactly once in the repo's server
   code. Eligibility is `age > send_attempts × 15 minutes`, computed per row in SQL, so the timer's
   period changes *when* a due row is picked up and never *how many attempts it gets* — which is
   FR-068 in one predicate. (D-4, D-5.)

Full reasoning in [`research.md`](./research.md) — 39 decisions across six groups. The table, its five
`CHECK`s and its three indexes in [`data-model.md`](./data-model.md); the two actions, the three
writers and the five reach-backs in [`contracts/mutators.md`](./contracts/mutators.md); delivery and
the sweep in [`contracts/mail.md`](./contracts/mail.md); the screen, the row and the sidebar count in
[`contracts/screens.md`](./contracts/screens.md).

## Technical Context

**Precondition — R1, R2, R5, R6, R7, R8, R9 and R10 are implemented on this branch, not merely
planned.** Every table, function, component and convention this feature builds on was read, not
assumed:

- **R1** — `src/db/schema.ts`'s fifteen tables and their conventions (`uuidv7` `$defaultFn`,
  `timestamptz`, `text` + `CHECK`, `num_nonnulls(...) = 1` on `comment` and `activity`, length
  checks); `src/db/tables.ts`'s `ALL_TABLES` and `truncateAllTablesStatement()`; `touched()`;
  `loadActor` / `requireActor`; `assertSameOrigin`; `publicUser` / `accountUser`;
  `src/lib/mail.ts`'s `sendMail` returning `"not_sent"` rather than throwing;
  `src/features/auth/server/mail.ts`'s `buildResetLink` precedent; `log.ts`'s `logMailSendFailure` and
  `logUnhandledServerError`; `sweep.ts`'s `sweep(now)` and `startSweep(runSweep)` with its
  `SWEEP_INTERVAL_MS = 5 * 60 * 1000`, `unref()` and `SIGTERM` handler; `bootstrap.ts`'s
  `(deps.startSweep ?? startSweep)()`; `instrumentation.ts`'s `register`.
- **R2** — `AppShell`, `Sidebar` with its `next/link` Notifications entry and `NAV_LINK_CLASSES`,
  `ScreenHeader` with its **already-declared** `control?: ReactNode` and `newIssue?: ReactNode` slots,
  `(app)/layout.tsx`'s actor-and-projects load, `ToastRegion` / `showToast`, the "This doesn't exist"
  convention, `(app)/route-guards.test.ts` (which enumerates `/notifications`).
- **R5** — `project`, `project_member`, `isMember`, `hasProjectMemberRow`, `deleteProject`'s
  archived-only transaction.
- **R6** — `issue` with `assignee_id` and `created_by`; `createIssue`'s transaction, its
  `issue_counter` update and its `TransactionRollbackError` path; `updateIssue`'s `for("update")`, its
  `fields` diff object and its eleven early returns; `deleteIssue`'s transaction; `createBoardCard` in
  `actions.ts`, which is FR-050's fourth path reaching `createIssue`.
- **R7** — `comment` and `activity`; `MENTION_TOKEN_PATTERN` **exported** from `mention-resolve.ts`;
  `createComment`'s transaction; `updateComment`'s single non-transactional `db.update`;
  `deleteComment`'s single `DELETE`; `comment-row.tsx:237`'s `id={`comment-${id}`}` anchor and its
  `Intl.RelativeTimeFormat` formatter.
- **R10** — `moveIssue`'s transaction, its `laneUnchanged` flag and its discriminated `MoveLane`.

**Consequently there is no blocked requirement, no placeholder import and no NEEDS CLARIFICATION.**
The spec's clarification session closed twelve product questions on 2026-09-06 and this plan treats
all twelve as settled.

**Language/Version**: TypeScript 7.0.2, `strict`. No `any`, no non-null assertions, no `@ts-ignore`.

**Primary Dependencies**: Next.js 16.3.2 (App Router), React 19.2.8 with React Compiler enabled
(`babel-plugin-react-compiler` 1.0.0), `react-aria-components` 1.20.0, `drizzle-orm` 0.45.2 over
`postgres` 3.4.9, `nodemailer` 9.0.6, `uuidv7` 1.2.1, Tailwind CSS v4 configured in CSS, Biome 2.4.2.

**Dependencies this feature installs**: **none**, and the spec agrees — *Dependency approval this
feature triggers*: none. Every capability it needs is on `AGENTS.md`'s approved table and in
`package.json` already: `nodemailer` for the mail (already wrapped by `src/lib/mail.ts`), `drizzle-orm`
for the table and its constraints, `uuidv7` for the key, `react-aria-components` for the one button,
and the Web platform's own `Intl.RelativeTimeFormat` and `URL` for the relative time and the deep link.

**Dependencies this feature deliberately refuses**, each absent from the approved table and therefore
barred by Principle IV without a recorded amendment: every job-queue and scheduler package —
`bullmq`, `agenda`, `node-cron`, `bree`, `pg-boss` — because §7 and FR-068 fix one in-process timer and
*Out of Scope* forbids "a second timer, a job table or a delivery log"; every mail-template library —
`mjml`, `react-email`, `handlebars`, `nodemailer-express-handlebars` — because FR-069 fixes plain text
with no template layer; every date library — `date-fns`, `dayjs`, `luxon` — because
`Intl.RelativeTimeFormat` already renders the one relative time this screen shows and R7 already uses
it that way.

**Configuration this feature changes**: `next.config.ts`, `vitest.config.mts`, `tsconfig.json`,
`drizzle.config.ts`, `biome.json` and `package.json` are all **untouched**. `src/db/test-database.ts`
needs no edit either — it calls `truncateAllTablesStatement()`, which picks up the one string added to
`src/db/tables.ts`.

**Storage**: PostgreSQL 18 via Drizzle. **One new table**, `notification`, with five `CHECK`
constraints, three indexes (two query, one partial unique) and five foreign keys — three of them
`ON DELETE CASCADE` and carrying this feature's entire delete story. **One migration**,
`drizzle/0008_*.sql`, generated by `npm run db:generate`, its SQL inspected and committed with
`drizzle/meta/0008_snapshot.json` and the journal (FR-009). No existing table gains a column, a
constraint or an index; no existing migration is edited. See [`data-model.md`](./data-model.md).

**Testing**: Vitest 4.1.11 in the two projects the repo already configures — `server` (node,
`fileParallelism: false`, migrating `TEST_DATABASE_URL` through `src/db/test-setup.ts`) for the
constraints, the recipient computation, the five reach-backs, the cascades, the two mutators, the mail
module and the sweep; `ui` (jsdom, `@testing-library/react`) for the screen, the row, the control, the
skeleton and the sidebar. Persistence, concurrency and constraint tests run against real PostgreSQL —
four of this feature's rules are `CHECK`s, one is a partial unique index under concurrency, three are
foreign-key cascades and one is an atomic increment, and a mock verifies none of them. `nodemailer` is
mocked with `vi.spyOn(nodemailer, "createTransport")`, the pattern eight existing test files already
use. `@react-aria/test-utils` is not installed and is not added; keyboard behaviour is verified with
explicit key events. The sweep is tested by passing an explicit `now`, never with fake timers.

**Target Platform**: self-hosted on a single box, Node.js runtime, one long-lived process — which is
what makes the fire-and-forget immediate send safe (D-2). Desktop browser only: no responsive layout
and no mobile breakpoint anywhere in this feature (FR-023).

**Project Type**: web application — one Next.js project, no separate frontend and backend.

**Performance Goals**: none stated by the specification and none invented. What the design fixes
instead: the list is one query with `LIMIT 200` on a covering index; the sidebar count is one
`count(*)` on a partial index; "Mark all read" is one statement rather than one per row (FR-028); a
write's response time is indistinguishable from the same write with mail disabled (SC-013); and the
sweep touches only rows its age predicate has made due.

**Constraints**: notifications are the system's **one** row-level read rule and this feature adds no
second one (FR-024) · a foreign row is indistinguishable from a missing one, never a permission
refusal (FR-026, SC-002) · the actor and every deactivated user leave every recipient set before any
insert; the `CHECK` is a backstop and never the mechanism (FR-004, FR-038, FR-039) · one row per
person per comment, enforced twice — in the computation and by a partial unique index (FR-006) ·
`mention` beats `comment` (FR-040) · every row lands in the causing transaction (FR-041) · a project
comment reads the membership **list**, never `isMember` (FR-048) · an assignment follows the field,
not the mutator, across four paths (FR-050) · an edit writes no `comment` row and withdraws nothing
(FR-054, FR-056) · no mutator deletes a notification (FR-032) · mail after commit, never inside it,
never awaited (FR-064, FR-065) · one immediate attempt plus at most three retries, spaced by the
row's own age, abandoned at the hour (FR-067) · one timer, no queue, no scheduler (FR-068) · plain
text, no template layer, no token in a link (FR-069) · revalidation on mutation is the only refresh;
no polling, socket or live push (FR-036) · nothing conveys state by colour alone (FR-012, SC-016) ·
`send_attempts` reaches no DTO and the recipient's address reaches no response (FR-073) · no
dependency outside `AGENTS.md`'s table (FR-075, IV) · desktop only (FR-023).

**Scale/Scope**: one installation, one team under twenty people. 75 functional requirements, 7 user
stories, 62 acceptance scenarios, 17 edge cases, 17 success criteria. 1 new table, 1 migration,
1 placeholder route replaced, 1 new screen, 2 new Server Actions, 3 new server writer functions,
2 new server queries, 2 new mail modules, ~4 new components, **12 edited files**, and **0 changes to
the three deletes**.

**Unknowns**: **none outstanding.** The one design question carried into implementation rather than
resolved on paper was settled there: one `refresh()` is sufficient and the named fallback was
deliberately not added — see *Complexity Tracking*.

## Constitution Check

*GATE: evaluated before Phase 0 and re-evaluated against the completed Phase 1 design. Both land on
the same row — Phase 1 introduced no principle question Phase 0 had not already settled. **Result:
pass**, with three items in Complexity Tracking and one inherited discrepancy recorded below them.*

Principles are hosted in [`AGENTS.md`](../../AGENTS.md);
[`.specify/memory/constitution.md`](../../.specify/memory/constitution.md) holds governance and the
version record (v1.0.0), which this plan does not amend.

| | Principle | Assessment |
| --- | --- | --- |
| **I** | Component-Driven Architecture | The feature splits along its own concerns: a list, a row, a header control, a skeleton; a writer, two queries, a mail builder, a sweep. Each owns one thing. The three shared abstractions all have their **second call site confirmed before extraction** — `writeAssignmentNotifications` has three (FR-050 names them), the mention parsing has two (`createComment`, `updateComment`), `dispatchNotificationMail` has five. What is *not* extracted is as deliberate: no shared "notification service" sits between the mutators and the database; no diff-builder is factored out of the three assignment call sites, because each already computes its own condition for its activity row; no relative-time module is promoted out of `comment-row.tsx`, because two four-line formatters in two different rows is not yet a confirmed shape; `src/components/ui/` is still not created. `MENTION_TOKEN_PATTERN` is **imported** from R7 rather than re-declared — one grammar, one definition. |
| **II** | Validated Input Boundaries | Two Server Actions, both public server entry points: origin, actor, parse, delegate — the order every action in the repo uses. `markNotificationRead` takes `notificationId: unknown` and refuses a non-string explicitly rather than coercing (FR-031); Postgres' `22P02` on a non-UUID is mapped the way `update-issue.ts` already maps it, never allowed to escape as a 500. `markAllNotificationsRead` takes **no parameter at all**, so FR-029's "a client-supplied identifier MUST change nothing" is structural. Every recipient set is computed from stored rows through one eligibility query and never from anything the client sends (FR-037). Authorization is `user_id = actor.id` inside the `WHERE`, which makes FR-026's "indistinguishable from a row that does not exist" a property of the statement. The screen reads no `searchParams`. |
| **III** | Straightforward Over Clever | The three deletes are three foreign keys, not three hand-written closures (C-1). Eligibility is one `WHERE` clause, not a scheduler. The retry state is one integer on the row, not a job table. The mail is two template strings, not a template layer. `markAllNotificationsRead` is one `UPDATE`. The one piece of raw SQL in the feature — `make_interval(mins => send_attempts * 15)` — exists because the predicate is per-row and no JavaScript expression can be a `WHERE` clause; it is localized to one module, fully parameterized, and covered by seven clock-driven tests. |
| **IV** | Built-In Features Over Third-Party Libraries | **Zero new dependencies**, and FR-075 says so outright. The mail transport and the timer are already in place; the relative time is `Intl.RelativeTimeFormat` and the link is `URL`, both Web platform. Job queues, schedulers, mail-template libraries and date libraries are each **refused by name** above rather than silently avoided, so a reviewer can see the decision was made. One inherited discrepancy — `clsx`, in `package.json` but not on the approved table — is recorded below rather than left to be found. |
| **V** | Intention-Revealing Code Without Comments | No comments in the diff. The five places a reader will want an explanation — why the deletes are untouched, why `send_attempts` exists at all, why the ids leave the transaction through a `let`, why an anchor rather than React Aria's `Link`, why the mark-read failure is silent — are answered by [`research.md`](./research.md) C-1, A-2, B-5, E-3 and E-6 and by the contracts, not by annotation. Names carry the rest: `writeAssignmentNotifications`, `dispatchNotificationMail`, `sweepNotificationMail`, `countUnreadNotifications`, `isUnread`. |
| **VI** | No Dead Code | **The largest single application is the three deletes**: an explicit `tx.delete(notification)` in each would be code whose removal changes nothing observable, and it is not written. `markAllNotificationsRead` declares no parameter for an identifier it must ignore. The DTO carries `isUnread: boolean` rather than `readAt: Date \| null`, because no surface renders the moment — a nullable date would be a field nothing reads. No fourth notification `type` is declared anywhere (FR-002). No unread mutator, no delete mutator and no notification-preference field exists. No seam is left for R12, which reads this table under the same rule when it lands. |
| **VII** | Test-First (NON-NEGOTIABLE) | All 62 acceptance scenarios are carried by a Red step written before its implementation, sequenced in `tasks.md`. Three Red steps are worth naming because they are easy to get wrong (F-2): the `send_attempts` test must assert **0 after commit and 1 after the dispatch settles**, or it passes against an implementation that increments before the attempt — which clarification 11 forbids; the mention-wins test must assert `rows[0].type === 'mention'` and not merely `length === 1`, or it passes against the inversion of FR-040; and every "no row is written" scenario is a **full census** before and after, never a query for the row expected to be missing. Concurrency, constraints and cascades are tested against real PostgreSQL, never a mock (F-1, F-3). |

### Gates 1–8

| # | Gate | How it is met |
| --- | --- | --- |
| 1 | A test written first and observed failing | Each task in `tasks.md` pairs one scenario with one implementation; the commit order is the evidence. [`research.md`](./research.md) F-2 fixes what the three subtlest Red steps are and why a passing-first-run test would not count. Phase 9 adds no Red of its own: its gate 1 is discharged by T005, observed failing against T006's first step, and T080–T084 are regression coverage over the already-shipped foreign keys |
| 2 | Minimal implementation, then refactor green | Scoped per task. Each mutator does no more than its entry in [`contracts/mutators.md`](./contracts/mutators.md); the three deletes do nothing at all |
| 3 | Server-side validation at every touched boundary | The Principle II row above, and [`contracts/mutators.md`](./contracts/mutators.md) §6's boundary table — every new entry point listed with its origin check, actor, authorization, input validation and safe result |
| 4 | No unapproved dependency | None installed; `package.json` is unchanged. Four categories refused by name in Technical Context. The inherited `clsx` discrepancy is recorded below, untouched |
| 5 | `npm run style-check` clean | Run as part of `npm run verify` |
| 6 | No comments, no commented-out code, no dead code | The Principles V and VI rows above |
| 7 | Every changed line traces to a requirement | Each path in Project Structure names the requirement putting it there. The three reach-backs into trees other entries own are named in Complexity Tracking, not left for the diff |
| 8 | `npm test` passes with nothing failing or skipped | Run as part of `npm run verify`. `--passWithNoTests` means a green run is not itself evidence of VII — the commit order is |

## Project Structure

### Documentation (this feature)

```text
specs/010-notifications-email/
├── spec.md                     the feature specification (clarification closed 2026-09-06)
├── plan.md                     this file
├── research.md                 Phase 0 — 39 decisions, six groups
├── data-model.md               Phase 1 — the table, its constraints, the cascades, the DTOs
├── quickstart.md               Phase 1 — 13 walkthroughs, and what a browser cannot show
├── contracts/
│   ├── mutators.md             the two actions, the three writers, the five reach-backs,
│   │                             and the three deletes that change nothing
│   ├── mail.md                 the message, the attempt counter, the sweep, R1's timer
│   └── screens.md              the screen, the row, the control, the sidebar count
├── checklists/                 spec-quality gate
└── tasks.md                    Phase 2 output (/speckit-tasks — NOT created by this command)
```

### Source code (repository root)

Every path is created or edited by this feature, and each names why it exists.

```text
src/
├── db/
│   ├── schema.ts                                    EDIT — one pgTable appended: notification,
│   │                                                  5 CHECKs, 3 indexes, 5 FKs
│   │                                                       FR-001…FR-008, FR-058…FR-061
│   └── tables.ts                                    EDIT — "notification" into ALL_TABLES so
│                                                      truncateTestDatabase() covers it        F-1
├── app/(app)/
│   ├── layout.tsx                                   EDIT — awaits the unread count beside the
│   │                                                  project list, passes it down     FR-033
│   └── notifications/page.tsx                       EDIT — the notFound() placeholder is
│                                                      replaced by the screen
│                                                            FR-010, FR-017…FR-021, FR-023
├── features/
│   ├── notifications/                               NEW — the feature; it owns the table
│   │   ├── actions.ts                               NEW — "use server"; markNotificationRead
│   │   │                                              and markAllNotificationsRead
│   │   │                                                    FR-025…FR-032, FR-036, FR-072
│   │   ├── components/
│   │   │   ├── notifications-list.tsx               NEW — the list and the one quiet line
│   │   │   │                                                    FR-011, FR-016, FR-022
│   │   │   ├── notification-row.tsx                 NEW — "use client"; the link, the
│   │   │   │                                          mark-read call, the dot, the time
│   │   │   │                                                    FR-012…FR-015, FR-025, FR-074
│   │   │   ├── mark-all-read-control.tsx            NEW — "use client"; the header's one
│   │   │   │                                          per-screen control, disabled at zero
│   │   │   │                                                    FR-020, FR-021, FR-028
│   │   │   └── notifications-skeleton.tsx           NEW — row-shaped, never a spinner   FR-017
│   │   └── server/
│   │       ├── write-notifications.ts               NEW — the three recipient writers, each
│   │       │                                          taking the caller's tx
│   │       │                                            FR-037…FR-057
│   │       ├── notification-queries.ts              NEW — listNotifications (LIMIT 200) and
│   │       │                                          countUnreadNotifications (no limit)
│   │       │                                                    FR-011, FR-022, FR-024, FR-033
│   │       ├── mark-read.ts                         NEW — the two mutators, one statement each
│   │       │                                                    FR-025…FR-032
│   │       ├── mail.ts                              NEW — dispatchNotificationMail (void) and
│   │       │                                          sendNotificationMail        FR-063…FR-071
│   │       └── mail-sweep.ts                        NEW — sweepNotificationMail(now); the age
│   │                                                  predicate                 FR-067, FR-068
│   ├── auth/server/
│   │   └── sweep.ts                                 EDIT — one line: the mail sweep joins the
│   │                                                  one timer's payload              FR-068
│   ├── activity/server/
│   │   ├── create-comment.ts                        EDIT — writeCommentNotifications inside its
│   │   │                                              existing tx; the dispatch after it
│   │   │                                                    FR-043…FR-049
│   │   └── update-comment.ts                        EDIT — gains a transaction and a FOR UPDATE
│   │                                                  read of the previous body, then the
│   │                                                  mention diff          FR-053…FR-057
│   ├── issues/server/
│   │   ├── create-issue.ts                          EDIT — writeAssignmentNotifications inside
│   │   │                                              its existing tx        FR-050, FR-052
│   │   ├── update-issue.ts                          EDIT — same, guarded by the fields object
│   │   │                                              it already builds     FR-050, FR-051
│   │   └── move-issue.ts                            EDIT — same, in the !laneUnchanged arm
│   │                                                                        FR-050, FR-051
│   └── shell/components/
│       ├── app-shell.tsx                            EDIT — one prop, forwarded         FR-033
│       └── sidebar.tsx                              EDIT — the count, and the accessible name
│                                                      that carries it     FR-033…FR-035
└── drizzle/
    ├── 0008_*.sql                                   NEW — generated, inspected, committed FR-009
    └── meta/0008_snapshot.json, _journal.json       NEW / EDIT — generated                FR-009
```

Untouched and named so, because a reviewer could reasonably expect otherwise:

- **`src/features/activity/server/delete-comment.ts`, `src/features/issues/server/delete-issue.ts`
  and `src/features/projects/server/delete-project.ts`** — the three deletes. Decision 1; C-1.
- **`src/lib/mail.ts`** — `sendMail` already returns `"not_sent"` rather than throwing on a missing
  or dead host, which is exactly what FR-070 needs (D-1).
- **`src/features/auth/server/bootstrap.ts`**, `instrumentation.ts`, and every part of `sweep.ts` but
  the one added line — `startSweep`, `SWEEP_INTERVAL_MS`, `unref`, the `SIGTERM` handler and the
  `catch` are R1's and are already tested there (D-5).
- **`src/features/auth/server/projections.ts`** — `publicUser` and `accountUser` stay byte-for-byte
  as R1 fixed them; the recipient's address is selected only inside the mail module, which returns
  nothing to a client (FR-073, D-7).
- **`src/features/shell/components/screen-header.tsx`** — its `control` and `newIssue` slots are used
  exactly as delivered; nothing is added to them.
- **`src/features/shell/components/toast-region.tsx` and `showToast`** — **this feature raises no
  toast at all.** FR-025 requires the mark-read failure to be silent, and no other write here has a
  refusal a user can act on.
- **`src/app/provider.tsx`** — no `RouterProvider` is added (E-3).
- `src/db/index.ts`, `touched.ts`, `unique-violation.ts`, `test-database.ts` · every migration
  `0000`…`0007` · `drizzle.config.ts` (the schema is still one file) · `package.json`,
  `next.config.ts`, `vitest.config.mts`, `tsconfig.json`, `biome.json` · the whole of
  `src/features/labels/`, `src/features/profile/`, `src/features/accounts/` ·
  `src/features/projects/server/authorization.ts` — **`isMember` is deliberately not called by the
  recipient computation** (FR-048) · `src/components/ui/` (still not created).

Two entries a first draft of this list carried and the tree does not bear out:

- **`src/features/board/` — untouched but for one deletion in `board-order.test.ts`.** No board
  component, hook, route or server module changes. The single edit is the removal of R10's
  `createIssue` working-tree guard, which `contracts/mutators.md` §4 forces; it is recorded in
  *Complexity Tracking* and is **pending human confirmation**.
- **`docs/ROADMAP.md` — one edit after all.** R11's spec-link cell moves from `—` to
  `specs/010-notifications-email/`, which is the convention the R8, R9 and R10 rows already follow.
  `Status` stays `planned`, no version is bumped and no history or status-log row is added, so the
  repository's no-history rule holds.

**Structure Decision.** `AGENTS.md`'s rules, followed exactly. `src/app` gains no domain module — the
notifications route resolves the actor, awaits a count, and renders; the `(app)` layout awaits one
more number. All behaviour lives under `src/features/`, with everything touching the database in a
`server/` directory carrying `server-only` directly or transitively through `@/db`. `actions.ts` is
the one module with top-level `"use server"` and it holds both actions. No barrel file mixes server
and client exports.

Three structural calls worth stating, because a reviewer could reasonably expect the other answer:

- **The recipient writers live in `src/features/notifications/server/`, not beside the mutators that
  call them.** They write the `notification` table, which this feature owns; splitting one table's
  write surface across `issues/` and `activity/` is the objection R10 recorded when it kept `moveIssue`
  in `issues/`. The precedent runs the other way and is exact: `writeActivity` lives in
  `activity/server/` and is imported by five files across three other features.
- **`markNotificationRead` and `markAllNotificationsRead` share one `actions.ts`.** `AGENTS.md`
  requires a dedicated module carrying top-level `"use server"`, not one per action, and two actions
  in one file is what `labels/actions.ts` and `activity/actions.ts` already look like.
- **The screen is a new feature directory rather than components under `src/app`.** `AGENTS.md`:
  "`src/app` holds routing, layouts, pages, and route handlers only. Do not turn pages or layouts into
  domain modules."

## Complexity Tracking

Three places this design reaches into work another entry owns, and one thing that looks like a
violation and is not. Each is recorded so a reviewer meets it here rather than discovering it in the
diff (gate 7).

| Violation | Why needed | Simpler alternative rejected because |
| --- | --- | --- |
| **Five mutators R6, R7 and R10 own are edited** — `createIssue`, `updateIssue`, `moveIssue`, `createComment` and `updateComment` each gain a writer call inside their existing transaction and a `dispatchNotificationMail` line after it; `updateComment` additionally **gains a transaction it does not have**. | The roadmap's R11 row, `OT-OPS-016` and `OT-OPS-013` all name these five by name, and R6's, R7's and R10's own roadmap rows each defer the notification here. `OT-DATA-009` requires the row in the same transaction as the change, which is only possible from inside the mutator. `updateComment`'s transaction is FR-057 and is recorded as a reconciliation in the spec itself. **None of the five changes its validation, its authorization, its activity writing, its refusal order or its result shape.** | *Compute recipients in the Server Action after the mutator returns.* Puts the row outside the causing transaction — FR-041 and `OT-DATA-009` forbid it, and a rolled-back change would leave a notification behind (SC-010). *Database triggers.* §5's conventions rule out triggers for `updated_at` and the same reasoning applies harder here: a trigger cannot see the actor, cannot read a comment's mention tokens against the `user` table cheaply, and is invisible at every call site. *Widen the five result types to return the ids.* Forbidden by the spec's *Out of Scope* ("return shapes are left as the entries that own them delivered them") and would touch twenty-odd existing test files (gate 7). |
| **Three files R2 owns are edited** — `(app)/layout.tsx` awaits one more value, `app-shell.tsx` forwards one prop, `sidebar.tsx` renders the count and its accessible name. | FR-033 requires the count "on every authenticated screen", which *is* the shared layout, and R2's roadmap row defers the Notifications unread count here by name. The edits are additive: three props threaded through a component that already threads `projects` the same way, and one `aria-label` on a link that already exists. | *Read the count in a Client Component inside the sidebar.* A Client Component may not reach the database (`AGENTS.md`), so it would need a fetch — and FR-036 forbids polling and any live push. *Put the count only on `/notifications`.* Fails FR-033 outright. *A separate `<NotificationCount>` Server Component slotted into the sidebar.* React does not let a Server Component render inside a Client subtree without being passed as a child, and `Sidebar` is a Server Component already — the prop is simpler and it is what `projects` already does (III). |
| **`src/features/auth/server/sweep.ts` gains one line and, with it, an import of `src/features/notifications/`** — an auth module now depends on a notifications module. | FR-068 requires the retry sweep to run on "the one in-process interval timer the installation already runs for the sign-in throttle's sweep", with no queue, worker or scheduler. `startSweep` accepts exactly one callback and `sweep` is it. One import and one statement is the smallest change that satisfies it, and `startSweep`'s own mechanics stay untouched. | *Compose the two sweeps in `bootstrap.ts`.* Keeps the import direction clean — the honest argument for it — but moves the composed behaviour into an anonymous callback whose only test route is `bootstrap`, which asserts `APP_URL`, probes the database and seeds an admin before it reaches the timer. `sweep.test.ts` already calls `await sweep(NOW)` five times with an explicit clock; keeping the composition inside `sweep` keeps every retry-schedule test on that surface. Trading a testable seam for an import direction is the wrong side of Principle VII (D-5). *A second `setInterval` for mail.* FR-068 and *Out of Scope* forbid it in as many words. |

**Not recorded as a violation, because it is not one — but a reviewer will ask.** The three deletes
are listed in the roadmap and in the spec as gaining "the `notification` arm of the §4 cascades", and
this plan does not edit them. That is the correct implementation of the sentence, not an omission:
§4 says these are "Hard deletes, **cascading in the database**", and the arm is three
`ON DELETE CASCADE` foreign keys on the new table. An explicit delete statement in each would be dead
code (VI) and, in `deleteIssue` and `deleteProject`, incorrect unless it re-derived the transitive
closure by hand (C-1). Story 7's six acceptance scenarios are still written as tests, through the real
mutators, with a full census before and after.

**One test another entry owns was deleted, and implementation could not avoid it — recorded here so a
reviewer meets it rather than finding thirteen missing lines in the diff. Deleted, and pending human
confirmation.** Phase 4 removed R10's `describe("createIssue itself is untouched by this feature
(FR-026)")` block from `src/features/board/board-order.test.ts`, together with the
`import { execFileSync } from "node:child_process"` it left orphaned (VI). The deletion is forced:
[`contracts/mutators.md`](./contracts/mutators.md) §4 requires `create-issue.ts` to be edited, and
that block asserts `git diff --stat HEAD -- src/features/issues/server/create-issue.ts` is `""`, so
the two cannot both hold. The guard was also **inherently transient** — it asserts a property of the
*working tree* rather than of the code's behaviour, so it could only ever pass while R10 was itself an
uncommitted tree; the first commit of R10 would have made it vacuous and this feature's first edit to
`create-issue.ts` was always going to make it fail. **No behavioural R10 coverage was lost.** The
surrounding `describe("the composer's create lands at the foot of the project's order (FR-026,
FR-049, SC-013)")` suite is intact and green — `npx vitest run
src/features/board/board-order.test.ts` reports 3 passed, the same three cases R10 delivered: the new
issue lands after every existing one writing no existing row, two quick submissions do not touch each
other's index, and the lane's assignee and priority are carried and nothing else. The alternatives
were *keep the guard and leave `create-issue.ts` alone*, which contradicts FR-049 and §4 outright
because the composer path's `assignment` row is written inside `createIssue`'s transaction; *rewrite
the guard as a behavioural assertion*, which edits another entry's test for this feature's
convenience (gate 7) to assert what the three cases above already cover; and *restore it and let it
fail*, which is gate 8. **The deletion has not yet been confirmed by a human and is carried here as
an open item, not as a settled one.**

**One design question was carried into implementation rather than resolved on paper, and
implementation settled it: `refresh()` is sufficient.** `(app)/layout.tsx` is shared between
`/notifications` and every issue and project route, so a client-side soft navigation does not by
itself re-render it — which is why `markNotificationRead` calls `refresh()` and not only
`markAllNotificationsRead` (FR-036 is written about *every* write that changes the caller's unread
set). What could not be settled by reading was whether that one `refresh()` is sufficient in the
presence of a simultaneous navigation away from the row, so `tasks.md` carried an explicit test
(T052, T056) with `revalidatePath("/", "layout")` named in advance as the fallback.

**The finding, from the browser half run in Phase 6 (quickstart walkthrough 3, `CHK041`).** One
`refresh()` is sufficient. **Nothing was changed and `revalidatePath("/", "layout")` was deliberately
not added** — `src/features/notifications/actions.ts` calls `refresh()` alone, on the `ok` path for
`markNotificationRead` and unconditionally for `markAllNotificationsRead`. The evidence, from a dev
server run out of this worktree on port 3000 with six unread rows seeded for a development user and
the session minted directly (no password entered): the sidebar entry read
`aria-label="Notifications, 6 unread"`; activating a row soft-navigated to
`/projects/APOLLO/issues/1/details` and the shared `(app)` layout re-rendered to
`"Notifications, 5 unread"`, with the `window` marker still alive and `performance.navigation`
entries = 1 — the same document, no reload. The server log shows `POST /notifications →
markNotificationRead` followed by a second `GET` of the destination route, which is the `refresh()`
re-render landing on the destination. "Mark all read" then dropped the label to `null` and the badge
to nothing in the same document (the database reading 0 unread of 6), confirming FR-034 and SC-012.
The probe rows and the session were deleted afterwards and the development database was left at 0
notifications.

**One inherited discrepancy, recorded rather than fixed.** `package.json` carries `clsx@^2.1.1` as a
runtime dependency; it is **not** on `AGENTS.md`'s approved-dependency table, which that file calls
"the complete set". It predates R11, is imported only by `src/app/components/common/logo.tsx` and
`src/features/auth/components/primary-button-classes.ts`, and nothing in this feature adds, removes or
relies on it. It is named here because a reviewer applying gate 4 to this diff will read that table and
should know the discrepancy is inherited, not introduced. **Resolving it — an amendment recording the
approval, or removing the package — is not this feature's work and no task here does it.**

## Explicitly out of scope

Named so no task claims them: **digests, batching and any opt-out, preference, mute or per-project
subscription** — none in v1 by §3.6, and no field for one exists in the data model · **an HTML mail
body, a template layer or any mail styling** — plain text carrying the four facts FR-069 fixes ·
**notifying on anything but the three types** — status changes, activity records, labels, columns,
memberships and profile edits all notify nobody (FR-042) · **a fourth `type`**, anywhere · **live
push, sockets, real-time collaboration and polling** — the list and the count refresh on render and on
revalidation after a mutation, and on nothing else (FR-036) · **a second timer, a job table, a queue,
a worker, an external scheduler or a delivery log** — the retry state lives on the row (FR-068) ·
**exactly-once delivery** — a duplicate is preferred to a loss, and the hour and the four-attempt
bound cap it · **search, filtering, grouping, sorting, paging or infinite scroll on the list** — the
200-row bound is a cap, not a page control (FR-022) · **editing or deleting a notification by hand, or
marking one unread** — a row leaves only by cascade (FR-032) · **a per-row mark-read control** —
activating the row is `markNotificationRead`'s only surface (FR-025) · **changing who may read a
project, an issue or a comment** — this feature adds the system's one row-level read rule and no
second one · **reworking the five mutators** — their validation, authorization, activity writing and
result shapes are left as delivered · **Home's unread stat card and its Mentions list** — R12's, which
reads this table under the same own-`user_id` rule; **no seam is left for it here** · **any responsive
or mobile layout** (FR-023).

**No row is added to `docs/ROADMAP.md` §6 *Status log*, no version number is bumped anywhere, and no
history or log row is added to any document in this repository.**

## Phase status

| Phase | Output | Status |
| --- | --- | --- |
| 0 — Outline & research | [`research.md`](./research.md) | complete — 39 decisions; **no unknown outstanding**. R1…R10 read directly from the tree; `onNavigate` verified in the pinned Next's `link.d.ts`; the absence of a `RouterProvider` verified in `src/app/provider.tsx`; `sendMail`'s no-throw contract verified in `src/lib/mail.ts` |
| 1 — Design & contracts | [`data-model.md`](./data-model.md), [`contracts/`](./contracts/), [`quickstart.md`](./quickstart.md) | complete |
| Constitution re-check | this file | complete — **pass**, three items in Complexity Tracking, one non-violation and one inherited discrepancy recorded |
| 2 — Tasks | [`tasks.md`](./tasks.md) | complete — 92 tasks in ten phases, grouped by the seven user stories |
| Implementation | `src/`, `drizzle/0008_lush_donald_blake.sql` | complete — all ten phases, T001…T092. The one carried design question was settled in Phase 6: one `refresh()` re-renders the shared `(app)` layout, so `revalidatePath("/", "layout")` was **not** added — see *Complexity Tracking* for the browser evidence |
