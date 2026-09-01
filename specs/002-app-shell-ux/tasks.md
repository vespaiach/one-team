# Tasks: Application shell and cross-cutting UX

**Input**: Design documents from [`specs/002-app-shell-ux/`](.)

**Prerequisites**: [`plan.md`](./plan.md), [`spec.md`](./spec.md), [`research.md`](./research.md),
[`data-model.md`](./data-model.md), [`contracts/`](./contracts/), [`quickstart.md`](./quickstart.md)

**Tests**: **required, and written first.** Principle VII is non-negotiable in this repository and
change gate 1 asks for a test that was observed failing before its implementation. Every
implementation task below names the test task that must be Red before it starts.

**Organization**: by user story, in the spec's priority order. Each story is independently testable
against the *Independent Test* its phase states.

---

## Inherited from entry R1

**Entry R1 has landed.** This feature consumes, and does not build: `loadActor()` and `requireActor()`
with the `Actor` type (`src/features/auth/server/actor.ts`), `assertSameOrigin()`
(`src/features/auth/server/origin.ts`), the `session` table and `src/features/auth/server/sessions.ts`,
`MustChangePasswordBanner`, `src/proxy.ts`, the token set in `src/app/globals.css`, and the two Vitest
projects — `server` (node, `**/*.test.ts`, real PostgreSQL) and `ui` (jsdom, `**/*.test.tsx`).

Two properties of R1's implementation are load-bearing here and are asserted by R1's own suite, not
re-asserted by this feature:

- `loadActor` is `cache(loadActorImpl)`, so a request's guard and its render read one and the same
  actor — `FR-016`'s second sentence, satisfied by inheritance.
- `loadActorImpl` refreshes the session's sliding expiry, so an authenticated render both reads and
  writes. Sign-out is the only write this feature *originates*.

```bash
git log --oneline -1 -- src/features/auth/server/actor.ts
```

`T001` re-runs that check before the phases below, because every path they name assumes it.

---

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel — different files, no dependency on an incomplete task
- **[Story]**: `[US1]`…`[US4]`, mapping to the spec's four user stories
- Every task names the file it touches and the requirement that puts it there

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: the two configuration flags every later phase assumes, and the palette check that shows no third change is needed.

- [X] T001 Confirm entry R1 has landed by running the precondition check in [`quickstart.md`](./quickstart.md); stop here if it returns nothing
- [X] T002 [P] Add `experimental: { authInterrupts: true }` to `next.config.ts`, leaving `reactCompiler` and `logging` untouched (FR-019, research A-4)
- [X] T003 [P] Set `__NEXT_EXPERIMENTAL_AUTH_INTERRUPTS=true` for both Vitest projects in `vitest.config.mts`; without it every `forbidden()` test throws `E488` and looks like a Red step passing for the wrong reason (research D-2)
- [X] T004 [P] Confirm no token is added: run `src/app/globals.test.ts` and read the `--color-text-muted` / `--color-page` pair it already asserts. R1's warm ramp clears AA there (`#6e6a66` on `#f4f2f0` is 4.80:1), so the empty line uses `--color-text-muted` and `src/app/globals.css` stays untouched (contracts/app-shell.md, *Token contract*; R1 research A-4, *the warm ramp clears 4.5:1 for muted text on the page background*)

**On gate 1 for this phase.** T002 and T003 add no behaviour of their own — a flag and an environment
variable — and each is proved by a later Red step: T035 and T036. T004 adds nothing at all; it is a
read of an assertion R1 already ships. No test is written for them here and none is skipped.

**Checkpoint**: the runner can execute an interrupt-throwing test, and the empty line has a
contrast-safe muted colour without a new token.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: the two values every story's components are handed. `Actor` is R1's contract and this
phase reaches back into it — recorded in the plan's Complexity Tracking, not discovered in the diff.

**⚠️ CRITICAL**: no user story work can begin until this phase is complete.

- [X] T005 [P] Write the failing test for `displayName()` — first and last joined by a single space, both parts always present — in `src/features/shell/display-name.test.ts` — one rule, so the same person is named identically on every surface that renders them (FR-017, SC-010, `OT-UX-019`)
- [X] T006 [P] Write the failing test asserting `loadActor()` returns `avatarUrl` and `mustChangePassword`, against the real PostgreSQL instance `TEST_DATABASE_URL` names, in `src/features/auth/server/actor.test.ts` (FR-017, FR-026, data-model §1)
- [X] T007 Implement `displayName()` in `src/features/shell/display-name.ts`, outside any `server/` directory so a Client Component can call it and outside `src/lib` because Principle I extracts at the second call site (FR-017, research B-8) — makes T005 green
- [X] T008 Extend `Actor` and `loadActor()` in `src/features/auth/server/actor.ts` with `avatarUrl: string | null` and `mustChangePassword: boolean` — two more selected columns on the join `loadActor()` already makes, never a second query (FR-017, FR-026, research B-7) — makes T006 green

**Checkpoint**: the shell can be handed a display name, an avatar URL, a role and a flag. User story implementation can begin.

---

## Phase 3: User Story 1 — Every authenticated screen wears the same frame (Priority: P1) 🎯 MVP

**Goal**: one persistent 262px sidebar and a content region on every authenticated screen; a header
each page composes for itself; `/home` as the single headerless exception; the three screens outside
the shell staying outside it.

**Independent Test**: sign in as any account and open `/home` and one other authenticated route. The
sidebar renders identically on each, `/home` renders it without a header, and `/signin` and
`/reset?token=…` render neither. No other story needs to exist.

**Why first**: every entry from R3 onward renders inside this frame. Nothing else in R2 has value
without it, and no later entry can start without it.

### Tests for User Story 1 (write first, observe failing) ⚠️

- [X] T009 [P] [US1] Write the failing frame tests in `src/features/shell/components/app-shell.test.tsx`: 262px nav first in DOM order with the content region filling the remainder (s1), the frame identical across two renders with identical props (s2), no collapse, stack or hide and no media query at any width (s8), `min-w-[1280px]` on the shell root so the document scrolls horizontally instead of reflowing (s9), the sidebar still first in DOM order under a right-to-left direction with nothing else changed (s10), the `nav` and `main` landmarks with the bypass anchor as the first focusable element resolving to `#main-content` (s11), and no chrome beyond sidebar, header slot and banner slot (FR-001, FR-002, FR-009, FR-010, FR-031, SC-001, SC-011, SC-012)
- [X] T010 [P] [US1] Write the failing header tests in `src/features/shell/components/screen-header.test.tsx`: title block with a name and an optional context line, the second line omitted entirely rather than left empty when absent (edge case), the header rendering with a title block, exactly one control slot and the New issue slot (s4), the New issue slot rendering no control on a screen not scoped to a project (s5), the control slot rendering nothing rather than a placeholder when a screen has none (s6), height derived from content so a context line makes it taller, and a name too long for its width truncating on one line rather than wrapping or widening (FR-007, FR-008, FR-017)
- [X] T011 [P] [US1] Write the failing sidebar-geometry tests in `src/features/shell/components/sidebar.test.tsx`: a `nav` landmark carrying its own accessible name, `w-[262px]` with `shrink-0`, the full viewport height, the chip pinned to the bottom edge rather than following the entries in flow, the project-list region as the only part that scrolls within itself, and `sticky` with `start-0` so the horizontal scrolling FR-010 produces below 1280px does not carry the sidebar off-screen — an inline-start inset, not a `left`, so the pin follows the resolved direction like the 262px does (FR-005, FR-031)
- [X] T012 [P] [US1] Write the failing layout tests in `src/app/(app)/layout.test.ts`: with an actor the layout hands `AppShell` exactly `displayName`, `avatarUrl`, `isAdmin` and `showPasswordBanner` and no more; with no actor it renders its `children` and no frame; and it performs no authorization check of its own (FR-002, FR-015, contracts/app-shell.md). The no-actor branch is reached at execution and never at the browser: the framework renders a layout concurrently with the page beneath it, so the layout resolves `null` while the page's `requireActor()` redirects, and the output is discarded. It exists so the layout cannot throw on a request that is already leaving — not as a screen anyone sees, which `src/proxy.ts` and FR-021 between them rule out
- [X] T013 [P] [US1] Write the failing route test in `src/app/(app)/home/page.test.ts`: `requireActor()` runs first, and the page renders no header — no title block, no control slot, no New issue slot (s3, FR-003)
- [X] T014 [P] [US1] Write the failing structural test in `src/app/route-groups.test.ts`: no module under `src/app/(auth)` imports from `@/features/shell`, and `src/app/(app)/layout.tsx` is the only layout carrying the shell — which is what makes FR-004 structural rather than a rule three pages must remember (s7, FR-004, SC-003). The same test enumerates every `page.tsx` and `route.ts` under `src/app/` — not only under `(app)/` — and asserts the set equals the surface table's authenticated routes, plus `(auth)/`'s three public screens and the two R1-owned responders the table records beneath it (`src/app/page.tsx`, which only redirects `/` to `/home`, and `src/app/api/auth/signin/route.ts`, which §6 pins). Enumerating `(app)/` alone would prove the group adds nothing, not that nothing outside the table answers, which is what FR-028 and SC-002 actually claim. `/home` is the only route rendering no header (FR-028, SC-002). The same test asserts no `loading.tsx` exists anywhere under `src/app/(app)/`: the frame renders from an actor already resolved and has no pending state of its own, and a skeleton above a guard would turn a 403 or a 404 into a streamed 200 (FR-002, contracts/route-surface.md)

### Implementation for User Story 1

- [X] T015 [P] [US1] Implement the sidebar's geometry in `src/features/shell/components/sidebar.tsx` — the `nav` landmark, its accessible name, `w-[262px] shrink-0`, `sticky start-0` so document-level horizontal scrolling leaves it in place, `border-e` not `border-r`, `--color-page` fill, full height, the internally scrolling project-list region and the chip pinned to the foot with `mt-auto` (FR-005, FR-031) — makes T011 green
- [X] T016 [US1] Implement `src/features/shell/components/app-shell.tsx` — the `min-w-[1280px]` flex row, the bypass anchor as the first focusable element, `<Sidebar>` first in DOM order, `<main id="main-content">` filling the remainder on `--color-surface`, and the banner slot placeholder above `children` (FR-001, FR-002, FR-009, FR-010, FR-031) — depends on T015, makes T009 green
- [X] T017 [P] [US1] Implement `src/features/shell/components/screen-header.tsx` — title block, optional context line, one control slot, the New issue slot pinned to the far inline end, every slot rendering nothing when empty (FR-007, FR-008) — makes T010 green
- [X] T018 [US1] Implement `src/app/(app)/layout.tsx` — `loadActor()` for presentation only, `displayName()` from T007, and the four props handed to `AppShell`; no authorization check lives here (FR-002, FR-015, research A-3) — depends on T007, T008, T016, makes T012 green
- [X] T019 [US1] Implement `src/app/(app)/home/page.tsx` — `requireActor()` and nothing else; no header and no content until R12 (FR-003, FR-029, research *Assumptions carried forward* 1) — depends on T018, makes T013 green
- [X] T020 [US1] Refactor with the tests green across the four files this phase created — `src/features/shell/components/app-shell.tsx`, `sidebar.tsx`, `screen-header.tsx` and `src/app/(app)/layout.tsx`: no media query anywhere in them, no comment added, and no component taking a prop its scenario does not require (gates 2, 6)

**Checkpoint**: US1 is fully functional and testable on its own. The frame exists; the sidebar is a shaped, empty nav; entries arrive with US2.

---

## Phase 4: User Story 2 — The sidebar shows each person only the doors they can open (Priority: P2)

**Goal**: role-aware entries that are absent rather than greyed for a non-admin, the chip that names
the signed-in user the way the whole application names them, and the one sign-out control.

**Independent Test**: sign in as an admin and as a member against the same installation and compare
the two sidebars. Change one account's role and reload — the entries follow the role on the next
render, with no sign-out in between. Then use the sign-out control and confirm the session ends.

### Tests for User Story 2 (write first, observe failing) ⚠️

- [ ] T021 [P] [US2] Append the failing entry tests to `src/features/shell/components/sidebar.test.tsx`: Accounts, Labels and the `+` present under `isAdmin` (s1); all three absent under a member, with no element for them at all and none rendered disabled (s2); Home, the project-list region, Notifications and the chip present regardless of role (s6); the seven items in FR-005's order — app mark, Home, project-list region, Notifications, Accounts, Labels, chip — read from the rendered DOM under an admin, and the same order with the three admin items removed under a member, so the order is asserted and not only the membership of the set; no team switcher and no control that changes which team is in view (s10); the entries flipping between two renders when `isAdmin` changes, with no remount and no row touched (s4, s5); and focus travelling the entries in visual order, each with a visible focus indicator distinguishable without colour, each followable without a pointer (s9) (FR-005, FR-006, FR-011, FR-012, FR-016, FR-031, SC-004, SC-005)
- [ ] T022 [P] [US2] Write the failing empty-surface test in `src/features/shell/components/project-list-region.test.tsx`: one quiet line reading exactly `"No projects yet."`, no illustration and no empty-state marketing, rendered in `--color-text-muted` — R1's own token, which its warm ramp clears AA against `--color-page` with and `src/app/globals.test.ts` already asserts (s8, FR-024, `OT-UX-007`)
- [ ] T023 [P] [US2] Write the failing chip tests in `src/features/shell/components/user-chip.test.tsx`: first and last joined by one space (s7); no `avatarUrl` renders the name alone with no substitute image; an `avatarUrl` that fails to load renders the same; two 200-character names truncate on one line without widening or wrapping the 262px sidebar while the untruncated name stays the accessible name; and the sign-out control is a sibling of the `/profile` link, never nested inside it (FR-017, FR-018, research B-5)
- [ ] T024 [P] [US2] Write the failing control tests in `src/features/shell/components/sign-out-control.test.tsx`: a form submission targeting `signOut` rather than an `onPress` handler, so it works before hydration; a `react-aria-components` `Button`; an accessible name; and a visible focus indicator (FR-018, FR-030, contracts/sign-out.md)
- [ ] T025 [P] [US2] Write the failing sign-out tests in `src/features/auth/actions.test.ts`, against the real PostgreSQL instance: a live session's row is gone, the cookie is cleared and the redirect is `/signin` (s11); the same call twice succeeds and reports nothing; a cookie naming no row succeeds, clears and redirects; a foreign `Origin` and a missing one are refused before anything is read or written, deleting no row and leaving the caller signed in; another live session for the same user is still present afterwards (s12); and a request replaying the old cookie resolves no actor (SC-013) (FR-018, `OT-SEC-009`, `OT-AUTHZ-004`)

### Implementation for User Story 2

- [ ] T026 [P] [US2] Implement `src/features/shell/components/project-list-region.tsx` — the region, the `+` rendered only under `isAdmin`, and the one quiet line; it reads no projects, because R5 owns those (FR-011, FR-024) — makes T022 green
- [ ] T027 [P] [US2] Implement `src/features/shell/components/user-chip.tsx` — the `/profile` link carrying the avatar or nothing plus the display name, with the sign-out control beside it (FR-017, FR-018) — makes T023 green
- [ ] T028 [P] [US2] Implement `src/features/shell/components/sign-out-control.tsx` with top-level `"use client"` — the feature's only client module and its only React Aria component (FR-018, FR-030) — makes T024 green
- [ ] T029 [US2] Add the single-session delete to `src/features/auth/server/sessions.ts`, R1's module — exactly one row, never the user's other sessions. R1 ships `issueSession`, `resolveSession` and `deleteAllSessionsForUser` and no single-row delete, so this is unconditional: the one it needs does not exist (FR-018, contracts/sign-out.md, research C-2)
- [ ] T030 [US2] Implement `signOut` in `src/features/auth/actions.ts`, R1's `"use server"` module, in the contract's order: `assertSameOrigin()`, read the cookie, delete the one row, clear the cookie, `redirect('/signin')` (FR-018) — depends on T029, makes T025 green
- [ ] T031 [US2] Add the entries to `src/features/shell/components/sidebar.tsx` in FR-005's order — app mark, Home, project-list region, Notifications, Accounts, Labels, chip — following the structural tree in [`contracts/app-shell.md`](./contracts/app-shell.md): the four routes (Home, Notifications, Accounts, Labels) are `next/link` anchors, Accounts and Labels rendered only under `isAdmin`; the app mark is presentational and is not a second route to `/home`; the project-list region is the `section` T026 builds; and the chip is T027's, a link with the sign-out control as its sibling (FR-005, FR-006, FR-011, FR-012, research B-4, B-5) — depends on T026, T027, T028, makes T021 green
- [ ] T032 [US2] Thread `displayName`, `avatarUrl` and `isAdmin` from `AppShell` into `Sidebar` in `src/features/shell/components/app-shell.tsx`, keeping the layout's props exactly the four `data-model.md` §3 fixes — depends on T031

**Checkpoint**: US1 and US2 both work independently. An admin and a member get different sidebars, and either can sign out.

---

## Phase 5: User Story 3 — A refusal keeps the frame and explains itself (Priority: P3)

**Goal**: the Forbidden screen inside the shell at the URL that refused, one not-found wording at two
mounts, and every authenticated route deciding *may you be here* before *is anything here*.

**Independent Test**: as a member, request an admin-only route and confirm the Forbidden screen
renders inside the shell at the same URL with a 403. Sign out and request the same route: the answer
is `/signin`. As an admin, request it again: the answer is "This doesn't exist".

### Tests for User Story 3 (write first, observe failing) ⚠️

- [ ] T033 [P] [US3] Write the failing Forbidden tests in `src/features/shell/components/forbidden-notice.test.tsx`: the code `403`, the sentence exactly `"You don't have access to this."`, and a link to `/home` labelled Home carrying an accessible name and a visible focus indicator; no full-screen takeover, so a refused user keeps the sidebar and reaches Home in one click (s1, FR-019, SC-006, §3.11)
- [ ] T034 [P] [US3] Write the failing not-found tests in `src/features/shell/components/not-found-notice.test.tsx`: the wording exactly `"This doesn't exist"`, capitalisation and apostrophe included; nothing about access anywhere in the output; and no header, because a path that matched nothing is not a screen and has no name for a title block (s5, s6, SC-008, FR-022, research *Assumptions carried forward* 2)
- [ ] T035 [P] [US3] Write the failing screen test in `src/app/(app)/forbidden.test.tsx`: it renders `ScreenHeader` named for the Forbidden screen itself rather than the screen that refused, with the per-screen control slot and the New issue slot both empty, above the notice (s9, FR-019, FR-007)
- [ ] T036 [P] [US3] Write the failing table-driven guard tests in `src/app/(app)/route-guards.test.ts`, one row per authenticated route in the surface table crossed with no actor, a member actor and an admin actor: no actor redirects to `/signin` and never reaches Forbidden (s3, SC-007); a session present but expired is treated exactly as no session (s4); a member on an admin-only route throws `NEXT_HTTP_ERROR_FALLBACK;403` at the requested URL, which stays the one that refused (s1, s2, s7, SC-006); an admin on the same undelivered route throws `…;404` (s8, SC-014); and every non-admin-only route throws `…;404` for any signed-in actor (FR-014, FR-019, FR-021, FR-022, FR-029, research D-1)
- [ ] T037 [P] [US3] Write the failing boundary tests in `src/app/not-found.test.tsx` and `src/app/(app)/not-found.test.tsx`: both mounts render the same `NotFoundNotice`, the `(app)` mount inside the shell and the root mount with the root layout only (SC-008, FR-022)

### Implementation for User Story 3

- [ ] T038 [P] [US3] Implement `src/features/shell/components/forbidden-notice.tsx` — code, one sentence, the route back to Home (FR-019) — makes T033 green
- [ ] T039 [P] [US3] Implement `src/features/shell/components/not-found-notice.tsx` — the one wording both mounts render (FR-022) — makes T034 green
- [ ] T040 [US3] Implement `src/app/(app)/forbidden.tsx` — `<ScreenHeader name="Forbidden" />` above `<ForbiddenNotice />`; it takes no props and has no route of its own (FR-019, FR-020) — depends on T017, T038, makes T035 green
- [ ] T041 [P] [US3] Implement `src/app/(app)/not-found.tsx` — the notice inside the shell, no header (FR-022) — depends on T039, part of T037
- [ ] T042 [P] [US3] Implement `src/app/not-found.tsx` — the same notice under the root layout only, for a URL matching no route (FR-022) — depends on T039, part of T037
- [ ] T043 [P] [US3] Implement the three admin-only guard routes — `src/app/(app)/projects/new/page.tsx`, `src/app/(app)/settings/accounts/page.tsx`, `src/app/(app)/settings/labels/page.tsx` — each `requireActor()`, then the role check calling `forbidden()`, then `notFound()`; both terminals throw so neither can be forgotten by the entry that fills the route (FR-019, FR-028, FR-029, SC-014, research A-6) — part of T036
- [ ] T044 [P] [US3] Implement the six signed-in-only guard routes — `src/app/(app)/profile/page.tsx`, `src/app/(app)/notifications/page.tsx`, `src/app/(app)/projects/[projectKey]/page.tsx`, `src/app/(app)/projects/[projectKey]/details/page.tsx`, `src/app/(app)/projects/[projectKey]/issues/new/page.tsx`, `src/app/(app)/projects/[projectKey]/issues/[issueNumber]/details/page.tsx` — each `requireActor()` then `notFound()`; the membership half of Create issue arrives with R5 (FR-028, FR-029, research A-6) — part of T036

**No `loading.tsx` above any guard in this phase.** A `403` or `404` is a real status only while the
response has not begun streaming; a skeleton above one of these checks turns the refusal into a
streamed `200`. When R3 implements FR-032, the skeleton goes *below* the guard
([`contracts/route-surface.md`](./contracts/route-surface.md)).

**Checkpoint**: all three stories work independently. Every route in the surface table answers, and answers in the right order.

---

## Phase 6: User Story 4 — The seeded admin is reminded on every screen, and blocked on none (Priority: P4)

**Goal**: one banner slot on every authenticated screen, Home included, that blocks nothing and
occupies nothing when empty.

**Independent Test**: sign in as an account carrying the must-change-password flag and confirm the
notice renders on every authenticated screen, Home included, while every control on those screens
stays operable. Clear the flag with `admin:grant` and confirm the notice stops rendering.

### Tests for User Story 4 (write first, observe failing) ⚠️

- [ ] T045 [P] [US4] Append the failing banner tests to `src/features/shell/components/app-shell.test.tsx`: with the flag set the banner renders in the slot at the top of the content region, above the header (s1) and on a headerless screen too (s2), while every control on the screen stays operable and no navigation is withheld (s3); with the flag clear no banner renders and the content region begins exactly where it would in a shell with no slot at all — the empty slot occupies no space (s4) (FR-025, FR-026, SC-009)
- [ ] T046 [P] [US4] Append the failing test to `src/app/route-groups.test.ts`: no module under `src/app/(auth)` renders a banner slot, so a screen outside the shell has nothing to render and nothing to suppress (s5, FR-027, edge case)

### Implementation for User Story 4

- [ ] T047 [US4] Implement the banner slot in `src/features/shell/components/app-shell.tsx` — at the top of `main`, above `children`, rendering R1's `MustChangePasswordBanner` under `showPasswordBanner` and emitting no element at all when it is false (FR-025, FR-026, FR-027) — makes T045 and T046 green
- [ ] T048 [US4] Confirm `src/app/(app)/layout.tsx` passes `showPasswordBanner` from the actor's `mustChangePassword` and nothing else changed in the layout's four props — depends on T008, T047

**Checkpoint**: all four stories are independently functional. The feature is complete.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [ ] T049 [P] Walk [`quickstart.md`](./quickstart.md) 1–11 against a running installation, including the two checks no unit test reaches: walkthrough 7's `/settings/nothing-here` answering as an unclaimed path rather than a refusal (FR-022), and walkthrough 10's right-to-left `Accept-Language` (FR-001)
- [ ] T050 [P] Confirm the six requirements with no test are still exactly six — FR-013, FR-023, FR-032, FR-033, FR-034, FR-035 — and that every inline deferral marker in [`spec.md`](./spec.md) is intact; a seventh would mean a route or a slot was quietly dropped (research D-4)
- [ ] T051 [P] Sweep the diff for gates 4, 6 and 7: no dependency added to `package.json`, no comment and no commented-out code, no dead code, and every changed line traceable to a requirement named in a task above
- [ ] T052 Run `npm run verify` from the repository root — the `style-check`, `type-check`, `test` and `build` chain `package.json` defines, which is exactly what CI runs
- [ ] T053 Confirm the untouched files named in [`plan.md`](./plan.md) are still untouched: `src/db/schema.ts`, `drizzle/`, `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/provider.tsx`, `src/app/globals.css`, `src/app/(auth)/`, `src/proxy.ts`, `src/instrumentation.ts`, `package.json`

---

## Dependencies & Execution Order

### Phase dependencies

- **Precondition**: entry R1 implemented. Blocks everything.
- **Setup (Phase 1)**: after T001. T002–T004 are mutually independent.
- **Foundational (Phase 2)**: after Setup. **Blocks all four user stories.**
- **US1 (Phase 3)**: after Foundational. No dependency on another story.
- **US2 (Phase 4)**: after Foundational. Extends two US1 files — `sidebar.tsx` and `app-shell.tsx` — so it follows US1 rather than running beside it.
- **US3 (Phase 5)**: after Foundational for its notices and guards; T040 additionally needs US1's `screen-header.tsx` (T017), because Forbidden renders the frame's header.
- **US4 (Phase 6)**: after US1's `app-shell.tsx` (T016) and `(app)/layout.tsx` (T018).
- **Polish (Phase 7)**: after every story it checks.

### Story dependencies

| Story | Needs | Why |
| --- | --- | --- |
| US1 | Phase 2 | `displayName()` and the extended `Actor` are the layout's props |
| US2 | Phase 2, and T015/T016 for the two files it extends | the entries live in the sidebar US1 shaped |
| US3 | Phase 2; T017 for T040 only | the notices and guards are otherwise self-contained |
| US4 | T016, T018 | the slot is in `AppShell` and its flag comes from the layout |

US3's notices and guard routes (T033, T034, T036, T038, T039, T043, T044) touch no file US1 or US2
owns, so a second developer can build them in parallel with US2 once Phase 2 is done. Only T040 waits.

### Within each story

Tests first, observed failing, for the intended reason. Then the minimal implementation. Then
refactor with the tests green. Components before the layout that composes them; the layout before the
routes that render inside it.

### Parallel opportunities

- T002, T003, T004 together
- T005, T006 together; then T007, T008 together
- T009…T014 together — six test files, no shared file
- T015 and T017 together; T016 waits on T015
- T021…T025 together; then T026, T027, T028 together
- T033…T037 together; then T038, T039 together, and T041…T044 together
- T049, T050, T051 together, before T052

---

## Parallel Example: User Story 1

```bash
# All six Red steps, one per file:
Task: "Frame tests in src/features/shell/components/app-shell.test.tsx"
Task: "Header tests in src/features/shell/components/screen-header.test.tsx"
Task: "Sidebar geometry tests in src/features/shell/components/sidebar.test.tsx"
Task: "Layout prop tests in src/app/(app)/layout.test.ts"
Task: "Home route test in src/app/(app)/home/page.test.ts"
Task: "Route-group boundary test in src/app/route-groups.test.ts"
```

```bash
# Then the two independent components:
Task: "Implement src/features/shell/components/sidebar.tsx"
Task: "Implement src/features/shell/components/screen-header.tsx"
```

---

## Implementation Strategy

### MVP first — User Story 1 only

1. Phase 1 Setup
2. Phase 2 Foundational
3. Phase 3 US1
4. **Stop and validate**: quickstart walkthroughs 1, 3 and 10 pass
5. The frame exists, which is the thing every later entry is blocked on

The MVP is a demo of the *frame*, not of a usable application: after Phase 3 the sidebar is a shaped,
empty nav with no entries and no chip. US2 is what makes it navigable, and the two together are the
first increment worth showing.

### Incremental delivery

1. Setup + Foundational → the shell can be handed its four values
2. + US1 → the frame · walkthroughs 1, 3, 10
3. + US2 → entries, the chip, sign-out · walkthroughs 2, 9, 11
4. + US3 → refusals and absences · walkthroughs 4, 5, 6, 7
5. + US4 → the banner · walkthrough 8

Each step leaves the ones before it green.

### Parallel team strategy

After Phase 2, one developer takes US1 → US2 (they share `sidebar.tsx` and `app-shell.tsx`) while a
second takes US3's notices and guard routes. They meet at T040, which needs US1's header. US4 is four
tasks and belongs to whoever finishes first.

---

## Notes

- **Every test in this feature is either a synchronous component render or an assertion on a thrown interrupt.** Vitest cannot render `async` Server Components and this repository has no E2E runner and cannot add one under Principle IV, so each async file is a thin wrapper over a synchronous component taking plain props. That constraint fixed the component boundaries, not taste ([`research.md`](./research.md) D-1).
- **`forbidden()` and `notFound()` are assertable precisely**: they set `error.digest` to `NEXT_HTTP_ERROR_FALLBACK;403` and `…;404`, so T036's guard-order table is a direct assertion on which digest comes back for which actor.
- **One test needs a real database.** T025 only. Everywhere else the actor is a value the test supplies, which is what lets T036 cover every route under both roles as one table-driven test rather than a fixture per route ([`research.md`](./research.md) D-3).
- **Six requirements get no task, by the spec's own design.** FR-013, FR-023 and FR-032…FR-035 are conventions this entry fixes and the first entry with a surface implements. Gate 1 asks this feature for no test it cannot write; T050 is the check that the count stays six.
- **T043 and T044 look like placeholders and are not.** Each guard-only route is the minimal implementation of FR-029 for its route, each carries a test in T036, and each is *replaced* — not deleted — by the entry that fills it. Without them, all three admin-only routes answer nothing and FR-019, FR-020 and four acceptance scenarios ship untested.
- **The header's three slots have no occupant here.** What T010 tests is the *absent* case, which US1 scenarios 5 and 6 state directly. Recorded in the plan's Complexity Tracking.
- Commit after each task or logical pair. The commit order is the evidence for gate 1 — one failing test before each implementation.
