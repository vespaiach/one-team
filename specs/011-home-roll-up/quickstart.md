# Quickstart: validating the Home roll-up (R12)

How to prove this feature works, end to end. Runnable commands and observable outcomes only — no
implementation code. The task breakdown lives in `tasks.md` (`/speckit-tasks`, not created by
`/speckit-plan`).

## Prerequisites

- Node.js and the repository's dependencies installed (`npm install`). **This feature installs
  nothing new** — every capability it needs is already on `AGENTS.md`'s approved table.
- A PostgreSQL 18 instance with two databases: `DATABASE_URL` for development, `TEST_DATABASE_URL` for
  the suite. Never point either at staging or production (`AGENTS.md`, Testing).
- Migrations applied: `npm run db:migrate`. **This feature generates none**, so the migration set is
  the one R11 left behind.
- The database's `TimeZone` set to the installation's own timezone. This is the operator setting
  `OT-DATA-004` names, and it is what makes the due-this-week window mean one thing for everyone
  ([`research.md`](./research.md) B-1). Check it with `SHOW TimeZone;`.

## The gate

```bash
npm run verify          # style-check → type-check → test → build; CI runs exactly this
```

Targeted runs while working:

```bash
npx vitest run src/features/home                       # the whole feature
npx vitest run src/features/home/progress.test.ts      # the rounding rules, no database
npx vitest run src/app/\(app\)/home/page.test.ts       # the page and its frame
npx vitest run -t "does not mark a mention read"       # one scenario by name
```

**A green `npm test` is not evidence of test-first** — it runs with `--passWithNoTests`. The commit
order is the evidence (gate 1).

---

## Scenario walkthroughs

Each maps to acceptance scenarios in [`spec.md`](./spec.md). Seed with `npm run seed` and adjust, or
insert rows directly against `DATABASE_URL`.

### 1 · The greeting and the three cards — US1 s1, s2, s3

Sign in as a user holding four assigned issues and seven unread notifications, open `/home`.

**Expect**: the greeting reads the user's first and last name joined by one space; three cards render
in the order *assigned to you*, *due this week*, *unread*, each with a number **and** a text label;
the assigned card reads `4`; the unread card reads `7` — the same number the sidebar's Notifications
entry carries beside it on the same render (SC-003).

### 2 · The card equals the section — US1 s2, SC-002

With the same user, count the rows under **Assigned to you**.

**Expect**: exactly four, one per assigned issue, each naming its key (`WEB-142`), its title and its
project. The number on the card and the number of rows are equal by construction, because both read
one cached call.

### 3 · The due-this-week window — US1 s4, SC-013

Give the user four assigned issues with `due_date` at today, today + 6, today + 8 and yesterday.

**Expect**: the due-this-week card reads `2`. Confirm which two by their keys — an off-by-one that
counts day seven and drops today also reads `2` ([`research.md`](./research.md) F-2). Then change the
**browser's** timezone (or open the page from a machine in another one) and reload: the number is
unchanged, because the comparison ran in PostgreSQL.

### 4 · No completion filter, and no membership filter — US1 s5, FR-012, *Edge Cases*

Move one of the four issues into a `done`-kind column; assign the user an issue in a project they hold
no `project_member` row for; assign them an issue in an archived project.

**Expect**: all three still list under **Assigned to you** and still count toward the assigned card.
The non-member project does **not** appear under **Your projects**; the archived one does not either.

### 5 · Empty surfaces — US1 s6, FR-040, SC-010

Sign in as a user with no assigned issues, no memberships, no mentions, in an installation with no
activity.

**Expect**: three cards reading `0`, and exactly **one line** of text under each of the four sections.
No illustration, no call to action, no empty-state marketing.

### 6 · No header — US1 s7, FR-002

On `/home`, inspect the region beside the sidebar.

**Expect**: no `<h1>` title block, no per-screen control, no New issue control, and no border under a
header — because there is no header. The sidebar is byte-identical to every other screen's.

### 7 · Progress, all six shapes — US2 s1…s6, SC-004

Seed the viewer into five active projects: ten issues with three `done` and two `canceled`; one with
no issues; one whose every issue is canceled; one with two `done`-kind columns holding issues in each;
one with two hundred counted issues of which one hundred and ninety-nine are done. Add a sixth,
archived.

**Expect**: `38%`, `0%`, `0%`, a figure counting both `done`-kind columns, `99%`, and the archived
project absent. Then move the last issue of the 199/200 project into a `done` column: it reads `100%`.
No project renders a blank, a dash, "n/a" or an error.

### 8 · Mentions, five and only five — US3 s1, s2, s3, SC-005

Seed seven `mention` notifications for the viewer, a spread of read and unread, plus several
`assignment` and `comment` ones.

**Expect**: exactly five rows, newest first, read and unread interleaved by recency, unread rows
carrying a dot **and** a screen-reader "Unread"; no `assignment` or `comment` row appears.

### 9 · Home marks nothing read — US3 s4, SC-006, SC-009

Note the unread card's number and an unread mention row. Activate the row; it navigates to the issue
or project, landing at the `#comment-<id>` anchor when the notification carries a comment. Navigate
back to `/home`.

**Expect**: the row is still unread and still carries its dot; the unread card's number is unchanged.
Confirm against the database: `select read_at from notification where id = ...` is still null, and a
full row census of every table is identical before and after exercising every element on the page.

### 10 · The read boundary — US3 s5, SC-007

Sign in as a second user in another browser and open `/home`.

**Expect**: each sees only their own mentions and their own unread count. There is no query parameter,
path segment or body value that widens either — `/home?userId=<the other user>` renders the caller's
own numbers unchanged.

### 11 · Recent activity, twenty rows across everything — US4 s1, s2, s4, s5, SC-008

Seed comments and activity across three projects and several issues, more than twenty rows total, from
more than one actor. Sign in as a user who belongs to **no** project.

**Expect**: exactly twenty rows, newest first, spanning every project; each names its actor, what
happened, and the issue key with its project (or the project name); no page control, no "load more"
and no infinite scroll is offered; and the member-of-nothing user sees the same twenty rows as anyone
else.

### 12 · One row per comment — FR-029, *Edge Cases*

Post a comment through the application (not by inserting a row), so `createComment` writes both a
`comment` row **and** its `comment`-type `activity` record, then open `/home`.

**Expect**: **one** row in **Recent activity** for that comment, not two. Twenty rows are twenty
distinct events. Note that an issue's own R7 feed still shows both — that is R7's behaviour and this
feature does not change it ([`research.md`](./research.md) B-5).

### 13 · No collapsing, no toggle — FR-031, FR-032

Have one actor make five changes to one issue inside five minutes.

**Expect**: five rows on Home, not one collapsed group. No Comments only / All activity control
appears anywhere on the page, and the viewer's `user.feed_filter` is neither read nor written —
confirm the column is untouched after the visit.

### 14 · Deterministic order — FR-036, SC-012

Insert two activity rows with identical `created_at`. Reload `/home` several times.

**Expect**: the same order every time, in all four sections.

### 15 · Skeletons and no layout shift — US5 s3, FR-038, SC-011

Throttle the database or the network and load `/home`.

**Expect**: the greeting paints first; each of the five data surfaces shows its own skeleton in its own
final geometry; no full-screen spinner appears; when data lands the greeting and the three stat cards
do not move, every element keeps its horizontal position and its own height, and the only movement is
the vertical reflow of content below a section whose real row count differs from the rows its skeleton
reserved — three for **Assigned to you** and **Your projects**, five for **Mentions**, twenty for
**Recent activity**.

### 16 · Re-query on revisit — US5 s2, FR-039

Open `/home`, navigate to another screen, change data in the database, navigate back.

**Expect**: the new data. Nothing renders from a client cache.

### 17 · No polling — FR-041

Sit on `/home` for two minutes with the server log visible.

**Expect**: no further requests. Numbers change only on the next navigation to the page.

### 18 · The redirect — US5 s4, FR-003

Request `/home` with no session cookie.

**Expect**: a redirect to `/signin`, and no fragment of Home's markup in the response.

---

## What a browser cannot show, and where it is proved instead

| Claim | Proved by |
| --- | --- |
| Zero rows change (SC-009) | a full census of `ALL_TABLES` before and after, in the `server` project |
| No second user's row is reachable (SC-007) | two-user query tests on `listRecentMentions` and `countUnreadNotifications` |
| The window is compared in the server's timezone (SC-013) | a query test placing `due_date` at the four boundary days |
| The comment dedupe (FR-029) | a query test that goes through `createComment`, not through a raw insert |
| No existing test moved, but the one carved-out assertion (SC-014) | `npm test` green with no R1–R11 test file in the diff except `src/app/(app)/home/page.test.ts`, whose single `expect(result).toBeNull()` in the "renders no header" case FR-044 and SC-014 carve out becomes a real no-header assertion |
| Home ships no client component (FR-004) | a file census: no `"use client"` under `src/features/home/` |
