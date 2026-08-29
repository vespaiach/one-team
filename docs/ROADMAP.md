# One Team — epic roadmap (v1)

## 1. Authority and method

| | |
| --- | --- |
| **Epic** | One Team v1 — a self-hosted work tracker for one team under twenty people |
| **Source of truth** | [`docs/product/specifications.md`](product/specifications.md) — "One Team — product specification (v1)" |
| **Requirement IDs** | [`docs/product/requirements-index.md`](product/requirements-index.md) — derived, not authoritative |
| **This document** | The epic's decomposition. It names and orders sub-features; it does **not** design them. |
| **Method** | Spec Kit, [Spec of Specs](https://github.github.com/spec-kit/concepts/spec-of-specs.html). Each sub-feature runs its own specify → plan → tasks → implement cycle. |
| **Precedence** | Two axes. **What** is built: specification › this roadmap › child specs — where a child spec and this roadmap disagree, this roadmap is reconciled first (§5). **How** it is built: `AGENTS.md` and the constitution supersede all other practices, conventions and agent defaults; where those two disagree, `AGENTS.md` is primary. |
| **IDs** | `R1`…`R12` are immutable. An ID is never reused, renumbered or repurposed. A withdrawn sub-feature is struck, not deleted. |
| **Status vocabulary** | `planned` · `in-progress` · `done` |
| **Constitution** | [`.specify/memory/constitution.md`](../.specify/memory/constitution.md) — **v1.0.0**, ratified 2026-08-29. Governance, the amendment procedure, the version history and the project's decision records, plus pointers to the principles, technology constraints and change gates `AGENTS.md` now hosts. Both registers are cleared. It binds every child spec (§1.1); it does not govern this roadmap's decomposition. |
| **How it is built** | [`AGENTS.md`](../AGENTS.md) — the primary source. It hosts the seven core principles (numerals and names unchanged), the approved-dependency table, the eight change gates, and this project's runtime and framework guidance: Next.js 16 carries breaking changes, so framework-level code is checked against `node_modules/next/dist/docs/` rather than recalled API knowledge. |

No behaviour below is invented. Every scope boundary restates or defers something the specification states.

### 1.1 Constitution gates

Constitution v1.0.0 changes nothing about the decomposition below — no slice is added, removed or reordered by it. It binds each child spec's plan and implementation through the eight change gates, which `AGENTS.md` now hosts and the constitution points to. Three of those shape how a slice is *specified*, not merely how its diff is reviewed:

- **Test-First (VII, non-negotiable)** — a failing test, observed failing for the intended reason, precedes every line of production code. A child spec's acceptance scenarios are therefore its Red step, written before implementation rather than recorded after it. The runner is Vitest, invoked by `npm test`.
- **Built-in over third-party (IV)** — every dependency needs team approval recorded *before* it is installed. `AGENTS.md` carries that record as a table under Technology constraints, and it is the complete set: a library absent from it needs its own amendment. R6 is where this bites first — `OT-DATA-015` has it render markdown, and no table entry covers parsing — so the subset is hand-written rather than bought, a decision recorded in `AGENTS.md` under Architecture notes and left to R6's child spec to design.
- **No speculative abstraction (I)** — a pattern must appear at two call sites before it is extracted. A slice that establishes an app-wide convention states the rule and implements it for its own first caller; the shared primitive is extracted when the second caller lands. This is why R7 delivers one feed component for both feeds, and why R2 ships no component library.

---

## 2. Sub-features

`Depends on` lists every slice this one consumes directly — a slice it reads tables, routes or conventions from. Some of those are also reachable transitively; §3's graph draws only the edges needed to fix the order, so the two lists differ by design. `Sub-spec` is filled in when the child spec directory is created (§4).

| ID | Sub-feature | Intent | Scope boundary | Requirements | Depends on | Status | Sub-spec |
|---|---|---|---|---|---|---|---|
| **R1** | Identity, sessions and sign-in | Stand the installation up and let an account holder in. | **Inherited from `main`:** the Drizzle + PostgreSQL pipeline — `src/db/index.ts`, `drizzle.config.ts`, `db:generate` / `db:migrate` — which R1 builds on rather than creates; R1 also deletes the placeholder `setup_check` table, which is dead code under Principle VI the moment real tables land. **In:** data-model conventions (UUIDv7, `text`+`CHECK`, `touched()`, length checks, the `publicUser` / `accountUser` projections, the read boundary); `user`, `credential`, `session`, `reset_token`, `auth_attempt`; Sign in §3.1 with its rejected, deactivated and throttled states; Forgot password; Change password (screen 13); the password policy; Argon2id; SHA-256 token digests; the sliding cookie; `loadActor()`; the origin check; the `auth_attempt` sweep and the single in-process timer that runs it; first-run seeding and the `must_change_password` banner; `admin:grant` and `admin:deactivate`, carrying the CLI-only `setUserRole` path and the `OT-INV-013` active-admin lock it shares with R3's `deactivateUser`; unauthenticated redirect to `/signin`. **Deferred:** `/invite/accept` and all invitation issuing (R3); Profile and its Change-password link (R4); the page sign-in lands on, and the shell that hosts the `must_change_password` banner on every screen (R2); the notification-mail half of the timer (R11). | `OT-SCOPE-006`, `OT-SEC-001`, `-002`, `-004`…`-012`, `-014`…`-019`, `OT-DATA-001`…`-003`, `-005`, `-006`, `OT-AUTHZ-004`, `-011`, `OT-OPS-003`, `-012`, `OT-INV-013`, `-016`, `-017` | — | `planned` | — |
| **R2** | Application shell and cross-cutting UX | Give every authenticated screen its frame, and fix the app-wide UX conventions once. | **In:** the 262px sidebar (app mark, Home, the project-list region and its admin-only `+` into Create project (hidden, not disabled, per `OT-UX-003`), Notifications, Accounts and Labels hidden for non-admins, user chip); the header contract (title block, one per-screen control slot, the New issue slot); the `must_change_password` banner slot every authenticated screen carries, rendering the banner R1 delivers; `/home` as a shell route rendering the sidebar **without** the header — `OT-UX-001`'s one exception, fixed here because it is a rule about the shell, not about Home; Forbidden §3.11; the "this doesn't exist" convention; hidden-not-disabled admin navigation; disabled-control-with-inline-reason; the React Aria first rule with Tailwind as visual layer only; the display-name rule; desktop-only with no breakpoint. **Fixed here as rules, not implemented here:** toasts, per-screen skeletons, re-query on navigation and the connection-lost banner — the shell has no writing or data-loading surface that exercises them. Each lands with the first slice that has one, R3 or R4 whichever is built first, so R2 states the rule and writes no code for it, and gate 1 asks for no test R2 cannot write. Under Principle I the shared primitive behind any convention is extracted at its second call site, so R2 ships no component library. **Deferred:** Home's content (R12); the project list's data and its ordering (R5); the Notifications unread count (R11); what the New issue slot points at (R6); every screen the sidebar links to. | `OT-SCOPE-004`, `-007`, `OT-UX-001`…`-007`, `-016`…`-019`, `-021`, `OT-SEC-015`, `OT-AUTHZ-005`, `-012` | R1 | `planned` | — |
| **R3** | Accounts and invitations | Populate the team — invite, accept, deactivate, reactivate. | **In:** `invite`; `/settings/accounts` with the Invitations and Accounts tabs; the Invite modal and `inviteUser`, `resendInvite`, `revokeInvite`; the 7-day single-use link; `/invite/accept` with its expired, used and unknown states; `deactivateUser` and `reactivateUser` with their confirmations; the last-active-admin guard; deactivation ending every session; the roster with role, joined date and project count. **Deferred:** role changes, which stay CLI-only; project membership (R5) — the roster's project count reads `project_member` rows and reads zero until then; each picker's exclusion of deactivated users takes effect as that picker lands (R5, R6, R7). | `OT-SEC-002`, `-003`, `-013`, `-016`, `OT-AUTHZ-006`, `-011`, `-014`, `OT-DATA-005`, `OT-UX-011`, `OT-INV-013` | R1, R2 | `planned` | — |
| **R4** | Profile | Let a signed-in user maintain their own record, and nobody else's. | **In:** `/profile`; in-place editing of avatar URL, first name, last name, job title, Slack handle, phone and bio; `updateOwnProfile`; email and account role shown as immutable values, not controls; the Change password link that reuses R1's request-and-token mechanism and throttle. **Deferred:** any route to view or edit another user's profile — none exists; role and email editing; `user.feed_filter`, which lands with the feed that uses it (R7). Editing your own profile writes no activity and notifies nobody. | `OT-AUTHZ-001`, `OT-DATA-005`, `-016`, `OT-UX-009`, `-010`, `-019`, `OT-SEC-004`, `-012` | R1, R2 | `planned` | — |
| **R5** | Projects — creation, record, membership and lifecycle | Create the container work lives in, decide who may write in it, and retire it. | **In:** `project`, `project_member`, `board_column` seeded with its five rows, `issue_counter`; the `isMember` predicate and the write boundary it draws; `createProject`, `updateProject`, `setProjectStatus`, `deleteProject`, `addProjectMember` and `removeProjectMember`; Create project §3.7 with the derived, immutable key and its uniqueness check, colour, dates and member chips; Project details §3.8 record section with in-place editing; the admin-only Status switch; the Members roster with add and remove; Delete, archived-only, with its cascade; the sidebar project list ordering; the project header with colour dot, name and the Board / Details tab pair. **Deferred:** column editing (R9) — the Columns section renders as the read-only list §3.8 already defines; the Activity section and the header's comment count (R7); activity records for every change on this screen (R7); the `notification` arm of `deleteProject`'s §4 cascade (R11), which lands with the table itself; the `/projects/:projectKey` board that the sidebar and the Board tab point at (R10). | `OT-SCOPE-002`, `OT-AUTHZ-001`, `-004`, `-006`, `-013`, `OT-DATA-007`, `-008`, `-013`, `-015`, `OT-UX-008`…`-012`, `-020`, `OT-OPS-010`, `-011`, `OT-INV-007`, `-008`, `-016` | R2, R3 | `planned` | — |
| **R6** | Issues — creation, detail and editing | Create a unit of work, open it at a shareable URL, and change every field on it. | **In:** `issue`; per-project numbering under a row lock and the permanent `WEB-142` key; Create issue §3.5 as a full page; Issue detail §3.4 as a full page with its 262px rail; in-place title and description editing; the basic-markdown subset stored as source and rendered on read, adding no dependency (§1.1); the rail's column, priority, assignee and due-date controls; `createIssue`, `updateIssue`, `deleteIssue`; the assignee pool of members plus every admin, deactivated excluded; the assigned-non-member state and its explanation. **Deferred:** the Labels field and the rail's label picker (R8); the Activity section (R7); the `notification` arm of `deleteIssue`'s §4 cascade, and every notification `createIssue` or `updateIssue` causes (R11); ordering semantics and drag (R10) — creation writes its initial `sort_order` at the foot of the project's order per `OT-DATA-018`, and nothing else in this slice touches ordering; the board (R10). Both `createIssue` and `updateIssue` set `issue.assignee_id`, so `OT-OPS-016` has R11 reach back into each of them. | `OT-SCOPE-003`, `OT-AUTHZ-007`, `-015`, `OT-DATA-004`, `-007`, `-008`, `-012`, `-015`, `-018`, `OT-UX-008`…`-011`, `-021`, `OT-INV-001`…`-004`, `-009` | R5 | `planned` | — |
| **R7** | Comments and activity feeds | Give projects and issues one shared, append-only history that people can talk in. | **In:** `comment`, `activity`, `user.feed_filter`; one feed component serving both §3.4 and §3.8 identically; the composer with `@mention` autocomplete built from Popover and ListBox, members and admins ranked first, deactivated excluded; `createComment`, `updateComment`, `deleteComment` with their authorship rules and cascades; the Comments only / All activity toggle remembered across both feeds; five-minute collapsing; 50-row pages appended on scroll; the project comment count in the header; the `#comment-<id>` anchor on every comment row, which R11's deep link targets; **and activity writing added to the R5 and R6 mutators**, in the same transaction as the change each describes, `member_added` and `member_removed` carrying that member's display name frozen at write time under `OT-DATA-020`. **Deferred:** every notification these events cause — including the `mention` rows an edit newly names, which `OT-OPS-013` has R11 add to `updateComment` — and the `notification` arm of `deleteComment`'s §4 cascade (R11); label activity (R8); Home's cross-project roll-up (R12). Column activity stays R9's: R7 establishes the writer, R9 writes the five column events through it under `OT-DATA-019`. | `OT-AUTHZ-007`, `-008`, `-009`, `-014`, `OT-DATA-009`…`-011`, `-014`, `-016`, `-020`, `OT-UX-013`…`-015`, `OT-INV-010`, `-011` | R5, R6 | `planned` | — |
| **R8** | Labels | One team-wide label set, curated by admins and applied by anyone who can write. | **In:** `label`, `issue_label`; `/settings/labels` with its alphabetical list and cross-project usage counts; the Create and Edit modals over the shared palette; `createLabel`, `updateLabel`, `deleteLabel` with its everywhere-at-once semantics and its counted confirmation; `addIssueLabel` and `removeIssueLabel`; the label pickers on the issue rail and on Create issue, with the admin-only "Manage labels" link hidden rather than disabled; `label_added` and `label_removed` activity, one row per label. **Deferred:** label chips on board cards (R10). Curating the set writes no activity, and a deletion writes none on the issues it is removed from — by §3.10, not by omission. | `OT-AUTHZ-010`, `OT-DATA-007`, `-008`, `-013`, `OT-UX-003`, `-011`, `-012`, `OT-INV-016` | R6, R7 | `planned` | — |
| **R9** | Board columns | Let an admin shape each project's columns without ever moving an issue. | **In:** `createColumn`, `updateColumn`, `moveColumn`, `deleteColumn`; add appends a column of kind `open`; inline rename and recolour from the palette; drag to reorder; the four delete refusals — non-empty, last column, last `canceled`-kind, last `done`-kind — each stating its own reason; case-insensitive name uniqueness as an inline error naming the existing column; `kind` fixed at creation; the per-column issue count; **and the activity records §3.8 requires for these five events**, written through the writer R7 establishes. **Deferred:** the board's rendering of the result (R10). | `OT-AUTHZ-001`, `OT-DATA-013`, `OT-DATA-019`, `OT-UX-012`, `OT-OPS-010`, `OT-INV-005`, `-006`, `-012`, `-014`, `-015`, `-016` | R5, R6, R7 | `planned` | — |
| **R10** | Board — grouping, drag and ordering | The Trello surface: the project's main screen and the app's centre of gravity. | **In:** `/projects/:projectKey`; columns as lists of cards and the card face; Column, Assignee and Priority grouping with Unassigned first; drag to move and to reorder; `moveIssue` writing one base-62 fractional index plus whichever field the grouping represents; one order per project with ties legal and `(sort_order, id)` as the sort; the inline "Add a card" composer and the chevron into R6's Create issue page; optimistic drag with last-write-wins; re-query on focus and every 30 seconds, including mid-drag. **Deferred:** locking, live push and real-time collaboration — out of scope by §1; every notification `moveIssue` or the inline composer causes (R11); the progress figure that reads `done` and `canceled` kinds (R12). Under `OT-OPS-016` a cross-lane drop under Assignee grouping notifies the new assignee, so R11 reaches back into `moveIssue` and depends on this slice directly. | `OT-SCOPE-004`, `OT-AUTHZ-007`, `-015`, `OT-DATA-017`, `-018`, `OT-UX-008`, `-021`, `OT-OPS-008`, `-009`, `-011`, `OT-INV-004` | R6, R8, R9 | `planned` | — |
| **R11** | Notifications and email | Tell people the three things worth interrupting them for, in the app and by mail. | **In:** `notification`; `markNotificationRead` and `markAllNotificationsRead`; `/notifications` with the unread dot, actor, type, target and relative time, and the deep link to the `#comment-<id>` anchor R7 emits; "Mark all read" as one `markAllNotificationsRead` call over the caller's own unread rows, the set scoped server-side from the session per `OT-AUTHZ-016`; the sidebar's unread count; recipient computation for `mention`, `assignment` and `comment` **added to R6's `createIssue` and `updateIssue`, R7's `createComment` and R10's `moveIssue`** — every write `OT-OPS-016` names, a row written whenever one sets `issue.assignee_id` to somebody other than the actor, and none written by a write that leaves the field unchanged or clears it; **the mention diff added to R7's `updateComment`** — one `mention` row per user the saved body newly names, no `comment` rows, no second row for anyone already holding one for that comment, and nothing withdrawn for a mention the edit removed; **the `notification` arm of the §4 cascades added to R5's `deleteProject`, R6's `deleteIssue` and R7's `deleteComment`**; the actor removed from every recipient set, and every deactivated user with them; a project `comment` reaching that project's `project_member` rows — the list, not the predicate, so an admin receives one only where they were added explicitly; mention winning over comment; the row written in the causing transaction; mail sent after that transaction commits, one message per notification; `emailed_at`, three retries over an hour, sharing R1's timer. **Deferred:** digests, batching and opt-out — none in v1; status changes and activity records notify nobody. | `OT-AUTHZ-003`, `-016`, `OT-DATA-009`, `-011`, `OT-OPS-001`…`-007`, `-013`…`-016`, `OT-INV-010` | R5, R6, R7, R10 | `planned` | — |
| **R12** | Home roll-up | One read-only landing page answering "what is mine, and what just happened". | **In:** `/home`'s content — the greeting, the three stat cards, Assigned to you, Your projects with the progress figure and its zero-denominator rule, Mentions, and Recent activity as the 20 most recent rows across every project and issue feed — all of it inside the headerless `/home` route R2 already delivers. The unread stat card and Mentions both read `notification` — Mentions the viewer's 5 most recent `mention` rows, read and unread alike, per §3.2 as amended — so `OT-AUTHZ-003`'s own-`user_id` rule binds Home. The progress formula and its zero-denominator rule are §3.2 behaviour with no index ID — the index extracts only rules spanning two or more capabilities — and R12 reads `done`- and `canceled`-kind columns without enforcing `OT-INV-014`, which is `deleteColumn`'s and stays R9's. **Deferred:** no writes and no new mutators — Home reads only, and cannot mark a notification read. | `OT-AUTHZ-002`, `-003`, `OT-DATA-004`, `OT-UX-001`, `-005`…`-007` | R7, R10, R11 | `planned` | — |

### Cross-cutting requirements

These are first fixed by the slice named and then hold for **every** later slice; the attribution decides where the convention is established, not who may cite it — a later row still names one where it materially exercises it (`OT-DATA-005` in R3 and R4, `OT-UX-008` in R6 and R10).

The attributions: `OT-DATA-001`…`-003` and `OT-DATA-005`, `-006` (R1); `OT-AUTHZ-004` (R1), `-005`, `-012` (R2); `OT-UX-002`, `-005`…`-007`, `-016`…`-019` (R2); `OT-UX-008` (R5); `OT-SCOPE-001`, `-005` (the whole epic — no slice may build an out-of-scope feature).

---

## 3. Dependency order

```mermaid
graph LR
  R1[R1 Identity] --> R2[R2 Shell]
  R2 --> R3[R3 Accounts]
  R2 --> R4[R4 Profile]
  R3 --> R5[R5 Projects]
  R5 --> R6[R6 Issues]
  R6 --> R7[R7 Comments & activity]
  R7 --> R8[R8 Labels]
  R7 --> R9[R9 Board columns]
  R8 --> R10[R10 Board]
  R9 --> R10
  R10 --> R11[R11 Notifications]
  R11 --> R12[R12 Home]
```

The graph is the transitive reduction: it draws the minimum edges that fix the build order, while §2's `Depends on` column names every slice a row consumes directly, including ones the graph reaches through an intermediate. Neither is stricter than the other — the graph decides order, the column decides what a child spec must read.

R4 sits off the critical path and may be built in parallel with R3 or later. R8 and R9 are independent of each other and may be built in parallel once R7 lands.

Two slices carry work back into earlier ones, deliberately, because the specification requires the behaviour to be transactional with the change it describes rather than bolted on afterwards:

- **R7** adds activity writing to the project and issue mutators delivered in R5 and R6.
- **R11** adds recipient computation to `createIssue` and `updateIssue` (R6), `createComment` (R7) and `moveIssue` (R10) — the three assigning mutators `OT-OPS-016` names, plus the commenting one — and the `mention` diff `OT-OPS-013` requires to `updateComment` (R7); adds the `notification` arm of the §4 cascades to `deleteProject` (R5), `deleteIssue` (R6) and `deleteComment` (R7), each of which §4 already specifies as reaching notifications; and adds the mail sweep to the timer R1 already runs.

`OT-OPS-016` puts `moveIssue` in that set, so R11 depends directly on R10 and the graph carries an `R10 --> R11` edge. Under the reduction that edge subsumes two others, which are therefore not drawn: R7 reaches R11 through R8 or R9 and then R10, and R10 reaches R12 through R11. Both slices still consume what those paths describe — R12's `Depends on` still names R10 — which is exactly the divergence between the graph and the column described above.

Any child spec for R5, R6, R7 or R10 must state that these later slices will touch its mutators and its deletes.

---

## 4. Linking contract

Linking is bidirectional and plain-text — no tooling required.

**Child → parent.** Every child `spec.md` carries the parent and its entry ID in the header block, immediately under `**Feature Branch**`:

```markdown
**Parent roadmap**: `docs/ROADMAP.md` → entry **R5**
```

**Parent → child.** When a child spec directory is created, its path replaces the `—` in that row's `Sub-spec` column, as a link:

```markdown
[`specs/005-projects/`](../specs/005-projects/)
```

Child specs live under `specs/<NNN>-<short-name>/`, numbered sequentially by `.specify/scripts/bash/create-new-feature.sh`. Roadmap IDs are **not** the directory numbers: `R5` is the immutable identity, `005-` is whatever the script assigns. Keep the two mapped only through the `Sub-spec` column.

The roadmap is accepted, so child specs may be created; none exists yet. `.specify/templates/spec-template.md` carries the `**Feature Branch**` line but no parent-roadmap line, so the author adds that line by hand.

---

## 5. Scope changes

1. **Amend the roadmap first.** It is the source of truth for decomposition.
2. **Then reconcile affected child specs**, in dependency order, and note the reconciliation in each.
3. **Never renumber.** Withdraw an entry by striking its row and setting its status; add new work as a new ID (`R13`, `R14`, …).
4. **Recurse when a slice stays too large.** If a sub-feature cannot be specified as a single coherent outcome, give it its own roadmap at `specs/<NNN>-<short-name>/roadmap.md` with its own immutable IDs, and leave this entry pointing at that directory.
5. **A change to `docs/product/specifications.md` outranks all of the above** — this roadmap is reconciled to the specification, never the reverse.

---

## 6. Status log

| Date | Change |
|---|---|

*No entries.*

---

*Decomposition of `docs/product/specifications.md`. Roadmap IDs are immutable and append-only.*
