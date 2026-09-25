# One Team Roadmap

**Feature:** One Team R1 as defined in [docs/one-team-spec.md](docs/one-team-spec.md) (SPEC-001). Admins invite a small team, create projects, and add members to them. Each project holds a description, milestones and resources. Its issues are tracked on a board and a list, with comments, attachments, activity feeds and notifications. It runs on one VPS with nightly backups.

This file splits R1 into 20 slices, one [spec-kit](https://github.github.com/spec-kit/concepts/spec-of-specs.html) cycle each (`/speckit.specify` → `/speckit.clarify` → `/speckit.plan` → `/speckit.tasks` → `/speckit.implement`). Each slice delivers something that works and can be tested, and draws its requirements, acceptance criteria and tests straight from SPEC-001. It does not restate or redesign them.

## Rules

- SPEC-001 stays authoritative for behavior. This roadmap decides only which slice builds what, and in what order. If a slice's spec disagrees with SPEC-001, fix the slice's spec.
- Every requirement ID in the SPEC-001 index (section 4) belongs to exactly one slice, its home. A slice is `done` when every acceptance criterion of its home requirements passes for everything built so far. Requirements that also cover features from later slices are listed in [Requirements that span slices](#requirements-that-span-slices), with the slice after which they are fully verified.
- Roadmap IDs (R1 to R20) never change once a sub-spec refers to them. If scope moves, update this file first, then the affected sub-specs.
- Start a slice only when every slice it depends on is `done`. Slices on separate branches of the dependency graph can run in parallel.
- A slice too big for one cycle is split into R*n*a, R*n*b and so on, here first.

## Roadmap

| ID | Sub-feature | Intent | Scope boundary | Depends on | Status | Sub-spec |
| --- | --- | --- | --- | --- | --- | --- |
| R1 | Foundation | A running, tested, empty app that the other slices build on | In: repo tooling, PostgreSQL and Drizzle, additive migrations, test runners, structured logs, same-origin check on state-changing requests, email sender with a test double. Deferred: all user-facing features | — | planned | — |
| R2 | Sign-in and sessions | The first Admin can sign in by magic link and sign out | In: setup command, magic link with confirm page, sessions, rate limit, auth gate. Deferred: invitations (R4), deactivation (R5) | R1 | planned | — |
| R3 | Production deployment and backups | The app runs on the VPS behind HTTPS, is monitored, and is backed up nightly | In: HTTPS, secrets file, uptime monitor, nightly off-VPS backups, one restore test. Deferred: launch checks (R20) | R2 | planned | — |
| R4 | Invitations | The Admin invites teammates, who join as Members | In: invite, resend, revoke, accept with name, Admin-only checks, stored and retried invitation emails. Deferred: deactivated-email case (R5) | R2 | planned | — |
| R5 | User administration | Admins manage who can use the app and with what role | In: deactivate, reactivate, promote, demote, last-Admin guard, own-name edit, security logging. Deferred: unassigning on loss of access (R9) | R4 | planned | — |
| R6 | Projects and membership | Admins create projects and control who sees them | In: create, rename, archive, restore, members, project lists, not-found isolation, archive lock. Deferred: project content (R7 and later) | R5 | planned | — |
| R7 | Markdown and project description | Project descriptions render safe basic markdown | In: shared markdown renderer, description editing, unsaved-changes prompt. Deferred: stale-save warning (R17) | R6 | planned | — |
| R8 | Issues | Members create, view and edit issues in a project | In: issue fields, create and edit forms, issue page, plain list view. Deferred: milestone field (R10), board (R11), filters (R12), conflicts (R17) | R7 | planned | — |
| R9 | Issue deletion and access-loss cleanup | Deleted issues are hidden and restorable, and assignees who lose access are cleared | In: soft delete, deleted list, restore, deleted-issue page, unassign on loss of access. Deferred: feed markers (R14) | R8 | planned | — |
| R10 | Milestones | Group issues under milestones and see progress | In: milestone create, edit and delete, the issue milestone field, progress. Deferred: milestone filter (R12) | R9 | planned | — |
| R11 | Kanban board | Move issues through statuses on a shared, ordered board | In: six columns, drag and keyboard moves, manual order, old closed cards hidden. Deferred: filters, search and sort (R12) | R9 | planned | — |
| R12 | Filter, sort, and search | Narrow and order issues in both views | In: filters (including Unassigned and No milestone), title search, fixed sorts and defaults, URL state | R10, R11 | planned | — |
| R13 | Comments and mentions | Discuss issues and projects and @mention teammates | In: comments on issues and projects, author edit and delete, mention picker. Deferred: notifications (R18), feed merge (R14) | R8 | planned | — |
| R14 | Activity feeds | See the history of each issue and project | In: issue and project feeds, append-only events, names as they were at the time, deleted-issue markers | R9, R10, R13 | planned | — |
| R15 | File uploads and issue attachments | Attach files to issues safely | In: 10 MB limit, content-checked allowlist, disk storage, authorized download, removal. Deferred: file resources (R16) | R9 | planned | — |
| R16 | Project resources | Keep links, notes and files on a project | In: link, note and file resources, URL scheme check, file cleanup | R7, R15 | planned | — |
| R17 | Conflicting-save detection | Warn instead of silently overwriting someone else's edit | In: per-field stale check for issues and project descriptions, input kept, non-conflicting changes allowed | R11, R13, R15 | planned | — |
| R18 | In-app notifications | Users are told about assignments, comments, mentions and status changes | In: notification rules, list, read state, unread count. Deferred: email (R19) | R11, R13 | planned | — |
| R19 | Notification emails | Notifications also arrive by grouped email | In: 5-minute grouping per user, content, skipping already-read notifications, stored and retried sends | R4, R18 | planned | — |
| R20 | Release verification | Confirm R1 meets its browser, speed and keyboard bounds and is ready to launch | In: TEST-014 on all browsers, fixes it finds, launch checklist from SPEC-001 section 14 | R1 to R19 | planned | — |

## Dependency order

Each wave depends only on earlier waves, so slices in the same wave can run in parallel.

| Wave | Slices |
| --- | --- |
| 1 | R1 |
| 2 | R2 |
| 3 | R3, R4 |
| 4 | R5 |
| 5 | R6 |
| 6 | R7 |
| 7 | R8 |
| 8 | R9, R13 |
| 9 | R10, R11, R15 |
| 10 | R12, R14, R16, R17, R18 |
| 11 | R19 |
| 12 | R20 |

Building R1 to R20 in order, one at a time, also respects every dependency.

## Slice details

Requirement IDs are each slice's home requirements from SPEC-001 section 4. The acceptance criteria and tests listed are the ones those requirements link to; they are the slice's definition of done.

### R1: Foundation

- **Requirements:** OPS-002, OPS-004, SEC-018, SEC-026
- **Acceptance:** AC-088, AC-089, AC-091, AC-141 · **Tests:** TEST-003, TEST-016
- **Also delivers:** the static, unit, integration and end-to-end commands that SPEC-001 section 13.2 leaves open, plus a request ID on every log line.
- **Workflows and sections:** SPEC-001 sections 11 and 12.

### R2: Sign-in and sessions

- **Requirements:** OPS-007, REQ-054, REQ-058, SEC-001, SEC-010, SEC-012, SEC-016, SEC-017, SEC-021, SEC-022, SEC-027
- **Acceptance:** AC-050, AC-064, AC-066, AC-072, AC-084, AC-085, AC-092, AC-109, AC-110, AC-135, AC-142 · **Tests:** TEST-001, TEST-003
- **Needs:** DEP-001 email vendor chosen within DEC-011.
- **Sections:** SPEC-001 5.4 (sign-in screen), 9 (authentication); LIMIT-006 and LIMIT-009.

### R3: Production deployment and backups

- **Requirements:** OPS-003, OPS-006, SEC-014, SEC-015
- **Acceptance:** AC-082, AC-083, AC-090, AC-117, AC-118 · **Tests:** TEST-015, TEST-016 (monitor part), TEST-017
- **Needs:** DEP-002 backup storage.
- **Sections:** SPEC-001 11 (backups), 12, 14 (release strategy and rollback).

### R4: Invitations

- **Requirements:** OPS-001, OPS-005, REQ-001, REQ-002, REQ-059, REQ-064, REQ-065, REQ-090, SEC-003, SEC-011, SEC-020
- **Acceptance:** AC-001, AC-002, AC-052, AC-065, AC-073, AC-081, AC-093, AC-099, AC-100, AC-108, AC-116, AC-138 · **Tests:** TEST-001, TEST-003, TEST-012 (invitation email part)
- **Workflows:** WF-001.

### R5: User administration

- **Requirements:** DATA-002, REQ-003, REQ-050, REQ-051, REQ-053, REQ-060, REQ-063, SEC-005, SEC-013, SEC-028
- **Acceptance:** AC-003, AC-054, AC-060, AC-067, AC-068, AC-069, AC-071, AC-094, AC-098, AC-143, AC-145 · **Tests:** TEST-001, TEST-002
- **Workflows:** WF-002. **Screens:** Admin, Users; Profile.

### R6: Projects and membership

- **Requirements:** REQ-004, REQ-005, REQ-006, REQ-007, REQ-008, REQ-010, REQ-049, REQ-055, REQ-088, SEC-002, SEC-009, SEC-019
- **Acceptance:** AC-004, AC-005, AC-006, AC-007, AC-008, AC-010, AC-049, AC-051, AC-058, AC-074, AC-107, AC-136, AC-144 · **Tests:** TEST-002, TEST-003
- **Also delivers:** the ActivityEvent table and the rule that each write commits its events in the same transaction. Project events are written from here on, and R14 displays them.
- **Workflows:** WF-008. **Screens:** Project list, Project overview (shell).

### R7: Markdown and project description

- **Requirements:** REQ-009, REQ-069, REQ-071, SEC-008, SEC-023
- **Acceptance:** AC-009, AC-057, AC-104, AC-106, AC-111 · **Tests:** TEST-004 (description part), TEST-013
- **Sections:** SPEC-001 6.1 (basic markdown), DEC-024.

### R8: Issues

- **Requirements:** REQ-011, REQ-012, REQ-013, REQ-014, REQ-016, REQ-017, REQ-023, REQ-056
- **Acceptance:** AC-011, AC-012, AC-013, AC-014, AC-016, AC-017, AC-023, AC-075 · **Tests:** TEST-004, TEST-006 (list part)
- **Also delivers:** the Issue table in full from SPEC-001 6.1, including `status_changed_at` and `board_position`, so later slices add no issue columns.
- **Workflows:** WF-003 (without the conflict check). **Screens:** Issue detail, List view (no filters).

### R9: Issue deletion and access-loss cleanup

- **Requirements:** DATA-001, REQ-018, REQ-019, REQ-020, REQ-061, REQ-083
- **Acceptance:** AC-018, AC-019, AC-020, AC-059, AC-095, AC-096, AC-130 · **Tests:** TEST-002, TEST-005
- **Workflows:** WF-005, WF-009. **Screens:** Admin, Deleted issues.

### R10: Milestones

- **Requirements:** REQ-015, REQ-034, REQ-035, REQ-036, REQ-037
- **Acceptance:** AC-015, AC-034, AC-035, AC-036, AC-037 · **Tests:** TEST-004 (milestone field), TEST-010

### R11: Kanban board

- **Requirements:** REQ-021, REQ-022, REQ-070, REQ-075, REQ-076, REQ-078, REQ-080
- **Acceptance:** AC-021, AC-022, AC-105, AC-122, AC-123, AC-125, AC-127 · **Tests:** TEST-006 (board part)
- **Workflows:** WF-004 (without the stale-status rejection, which R17 adds). **Screens:** Board.

### R12: Filter, sort, and search

- **Requirements:** REQ-024, REQ-025, REQ-077, REQ-079, REQ-081, REQ-082, REQ-091
- **Acceptance:** AC-024, AC-025, AC-124, AC-126, AC-128, AC-129, AC-139 · **Tests:** TEST-006 (filter, search and sort part)

### R13: Comments and mentions

- **Requirements:** DATA-005, DATA-008, REQ-028, REQ-029, REQ-030, REQ-031, REQ-032, SEC-004
- **Acceptance:** AC-028, AC-029, AC-030, AC-031, AC-032, AC-053, AC-077, AC-114 · **Tests:** TEST-003, TEST-008 (comment text part), TEST-009
- **Workflows:** WF-006 (without notifications).

### R14: Activity feeds

- **Requirements:** DATA-003, DATA-009, REQ-027, REQ-033, REQ-084
- **Acceptance:** AC-027, AC-033, AC-061, AC-115, AC-131 · **Tests:** TEST-008

### R15: File uploads and issue attachments

- **Requirements:** DATA-004, DATA-007, REQ-041, REQ-042, REQ-057, SEC-006, SEC-007, SEC-025
- **Acceptance:** AC-041, AC-042, AC-055, AC-056, AC-062, AC-076, AC-079, AC-080, AC-113, AC-140 · **Tests:** TEST-011 (upload part)
- **Workflows:** WF-007. **Sections:** SPEC-001 6.1 (upload allowlist), DEC-026.

### R16: Project resources

- **Requirements:** DATA-006, REQ-038, REQ-039, REQ-040, SEC-024
- **Acceptance:** AC-038, AC-039, AC-040, AC-078, AC-112 · **Tests:** TEST-011 (resource part)

### R17: Conflicting-save detection

- **Requirements:** REQ-026, REQ-072, REQ-073, REQ-074
- **Acceptance:** AC-026, AC-119, AC-120, AC-121 · **Tests:** TEST-007
- **Also delivers:** the stale-status rejection for column moves in WF-004.
- **Sections:** SPEC-001 6.1 (conflict check), DEC-027, LIMIT-008.

### R18: In-app notifications

- **Requirements:** REQ-043, REQ-044, REQ-045, REQ-046, REQ-047, REQ-052, REQ-062, REQ-066, REQ-067, REQ-068, REQ-089
- **Acceptance:** AC-043, AC-044, AC-045, AC-046, AC-047, AC-070, AC-097, AC-101, AC-102, AC-103, AC-137 · **Tests:** TEST-012 (in-app part)
- **Screens:** Notifications; unread count on every page.

### R19: Notification emails

- **Requirements:** REQ-048, REQ-085, REQ-086, REQ-087
- **Acceptance:** AC-048, AC-132, AC-133, AC-134 · **Tests:** TEST-012 (email part)
- **Sections:** SPEC-001 6.1 (grouped notification email), 12 (queue operations), DEC-032.

### R20: Release verification

- **Requirements:** NFR-001, NFR-002, NFR-003
- **Acceptance:** AC-063, AC-086, AC-087 · **Tests:** TEST-014, plus a final run of every automated test
- **Also delivers:** the SPEC-001 section 14 release steps on production (setup command, smoke check, invite the team).

## Requirements that span slices

These requirements have a home slice but also constrain slices built after it. Every later slice listed must meet them for its own features and add them to its own spec.

| Requirement | Home | Also applies in | Fully verified after |
| --- | --- | --- | --- |
| SEC-026 same-origin, non-GET state changes | R1 | Every slice with a state-changing request | R19 |
| SEC-018 no tokens, secrets or comment text in logs | R1 | Every slice that logs | R19 |
| OPS-004 additive migrations only | R1 | Every slice with a migration | R19 |
| SEC-001 authenticated access | R2 | R4 adds the invitation-acceptance exception | R4 |
| SEC-022, SEC-027 confirm-page tokens, hashed tokens | R2 | R4 (invitation tokens) | R4 |
| SEC-028 security events logged | R5 | Sign-in events from R2, rejected invitation links from R4 | R5 |
| SEC-003 Admin-only actions rejected for Members | R4 | R5, R6, R9 (each Admin-only action) | R9 |
| SEC-002 other projects answer "not found" | R6 | R7 to R16 (each project resource, including files) | R16 |
| SEC-009 archived projects are read-only | R6 | R7 to R16 (each kind of content); AC-144's unassignment needs R9 | R16 |
| SEC-019 role and membership read on every request | R6 | Every later permission check | R19 |
| DATA-003 activity events append-only and written with the action | R14 | R6 onwards writes events in the same transaction | R16 |
| REQ-071 unsaved-changes prompt | R7 | Every later form | R16 |
| OPS-001, OPS-005 stored and retried email | R4 | R19 (notification emails) | R19 |
| REQ-062 no notifications for users without access | R18 | Relies on R5 (deactivation) and R9 (access loss) | R18 |
| NFR-003 keyboard-only use | R20 | Every slice with UI | R20 |

## Running a slice

1. Pick the first `planned` slice whose dependencies are all `done`, and set it to `in-progress`.
2. Run `/speckit.specify` with the slice's intent, scope boundary and requirement IDs. Start the generated spec.md Input line with:
   `**Input**: Parent roadmap: `ROADMAP.md` → entry **R<n>**. Source: docs/one-team-spec.md (SPEC-001). <intent>`
   Copy the requirement, acceptance and test IDs from SPEC-001 unchanged rather than inventing new ones. Add the spanning rules above that apply to this slice.
3. Run `/speckit.clarify`, `/speckit.plan`, `/speckit.tasks` and `/speckit.implement` as normal.
4. When the slice's acceptance criteria pass, set its status to `done` and its Sub-spec to the feature folder (for example `specs/004-invitations/`; spec-kit numbers folders in the order they are created, so the number need not match the R ID). Mark its requirements `Implemented` in SPEC-001 section 4, or `Verified` once their tests pass.
