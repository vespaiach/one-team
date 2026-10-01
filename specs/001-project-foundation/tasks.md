---

description: "Task list for RM-1 Project Foundation"
---

# Tasks: Project Foundation

**Input**: Design documents from `/specs/001-project-foundation/`

**Prerequisites**: plan.md, spec.md, design.md (Frozen 2026-09-30), research.md, data-model.md, contracts/ (commands.md, http-api.md, ui-routes.md), quickstart.md

**Tests**: Requested. FR-020 and SC-003 require an automated test for every shared piece and a component test that renders each shared screen state directly. All tests run through `npm test` (Vitest: `*.test.ts` in Node, `*.test.tsx` in jsdom), sit beside the code they test, and are written with the code they cover, in the same phase or the next (the shared API wrapper's cases, T041 and T051, sit in the story phases whose behavior they prove). There are no browser end-to-end tests (DEC-005). FR-018 (refuse to start) is covered by T059 and FR-017 (settings file git-ignored) by T060 (T059 and T060 were inserted after the task list was generated, so their IDs are out of sequence; T061 was added after analysis); FR-013 (documentation only, no create endpoint in RM-1) and the AGENTS.md clause of FR-016 are documentation and need no automated test.

**Organization**: Tasks are grouped by user story so each story can be implemented and checked on its own.

**Constitution rules for every task**: no code comments of any kind (III); no package beyond those approved in constitution IV (v1.4.0) and listed in plan.md, "Resolved owner decisions" (IV); no fixture page, test-only route or unused code in the app (II); UI uses Hairline tokens, Button and TextInput only, and copy exactly as in design.md "Copy" (V).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (US1 to US5)
- Paths are relative to the repository root (single Next.js project, see plan.md "Project Structure")

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization, tool configuration and vendored design system

- [X] T001 Create `package.json` at the repository root with `"type": "module"`, `"engines": { "node": ">=24" }`, the scripts from contracts/commands.md (`dev`: `next dev`, `build`: `next build`, `start`: `next start`, `test`: `vitest run`, `lint`: `eslint . --max-warnings 0`, `db:migrate`: `node scripts/migrate.ts`), runtime dependencies `next` 16, `react` 19, `react-dom` 19, `postgres`, and dev dependencies `typescript` pinned to 5.x (a range such as `^5.8`, since `erasableSyntaxOnly` needs 5.8 or later), `@types/node`, `@types/react`, `@types/react-dom`, `eslint`, `eslint-config-next`, `vitest`, `@testing-library/react`, `@testing-library/dom`, `jsdom` (nothing else); run `npm install` to produce `package-lock.json`
- [X] T002 [P] Create `tsconfig.json` matching what Next.js 16 forces or suggests, so `next build` never rewrites the file: `target`, `lib: ["dom", "dom.iterable", "esnext"]`, `allowJs: true`, `skipLibCheck: true`, `strict: true`, `noEmit: true`, `esModuleInterop: true`, `module: "esnext"`, `moduleResolution: "bundler"`, `resolveJsonModule: true`, `isolatedModules: true`, `jsx: "react-jsx"`, `incremental: true`, `plugins: [{ "name": "next" }]`; plus the project's own `allowImportingTsExtensions: true`, `erasableSyntaxOnly: true` and `verbatimModuleSyntax: true` (so `scripts/migrate.ts` and its imports run through Node's type stripping, which keeps every import not marked `type`), with `strict` kept; `include: ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts", ".next/dev/types/**/*.ts"]` and `exclude: ["node_modules", ".claude"]` (the main checkout's `.claude/worktrees/` holds full repository copies that `**/*.ts` would otherwise type-check, the same reason ESLint ignores `.claude/` in T004), so `src`, `scripts` and `vitest.config.ts` are covered and `next build` type-checks test files too; `allowJs` lets `src/components/hairline.ts` import the untyped vendored `_ds_bundle.js` (add a type declaration beside `src/components/hairline.ts`, outside `src/hairline/`, if needed); the implementer confirms the final set by running a build (T023's `tsconfig.json`-unchanged check) (research R1, R6)
- [X] T003 [P] Create `next.config.ts` exporting a minimal typed `NextConfig` (no options beyond what the build needs, except `logging: { incomingRequests: false }`: owner decision 2026-10-01, Next's built-in request log prints full URLs including query strings, breaking FR-016)
- [X] T004 [P] Create `eslint.config.mjs` as a flat config using `eslint-config-next` core web vitals and TypeScript rule sets, ignoring `.next/`, `node_modules/`, `next-env.d.ts`, `.claude/` and the vendored `src/hairline/` (research R6, owner answer C2)
- [X] T005 [P] Create `.env.example` (it does not exist yet) with placeholder values only for `DATABASE_URL` (e.g. `postgres://USER:PASSWORD@localhost:5432/tracklite_dev`) and `TEST_DATABASE_URL` (`…/tracklite_test`), and verify, without changing it, that `.gitignore` already has the `.env*` and `!.env.example` rules (FR-017), `next-env.d.ts` (its generated comment must not be committed, Constitution III), `/.next/` and `/node_modules` (research R3, data-model.md "Configuration")
- [X] T006 Vendor into `src/hairline/`, byte-for-byte and never patched, keeping the export's sub-folder layout, only the Hairline files the app imports or references (owner decisions for T006, plan.md Q4, research R12): `components/buttons/Button.jsx`, `Button.d.ts`, `buttons.css`, `components/forms/TextInput.jsx`, `TextInput.d.ts`, `forms.css`, and `tokens/colors.css`, `tokens/typography.css`, `tokens/spacing.css`, `tokens/base.css`; do not vendor `_ds_bundle.js`, `styles.css` or `tokens/fonts.css`. From the owner-provided Google Fonts zip vendor TTF as-is (no conversion tool is approved) into `src/hairline/fonts/`: `Inter/Inter-VariableFont_opsz,wght.ttf` (400 to 700), `JetBrains_Mono/JetBrainsMono-Regular.ttf` (400) and `JetBrainsMono-Medium.ttf` (500), plus each family's `OFL.txt`; nothing else. Create `src/app/globals.css` with the app's own `@font-face` rules for these files (`format("truetype")`, `font-display: swap`, family names as in `tokens/typography.css`), so no font loads from the network and nothing in the app references `fonts.googleapis.com`; the root layout (T019) imports the token files, `buttons.css`, `forms.css` and then `globals.css`. Write the project's typed entry `src/components/hairline.ts` re-exporting `Button` and `TextInput` (their prop types are re-exported by the first slice that needs them, Principle II), so lint (T004) and the comment check (T055) cover it; if Button or TextInput does not pass through a prop the shared pieces need (`id`, `aria-invalid`, `aria-describedby`, `value`, `onChange`; the Button variants), add a thin wrapper in `src/components/` instead (owner answer F7; not needed: both pass these through). **Stop condition (plan.md Q4, research R12)**: if Button and TextInput are not usable as React components via import, or any vendored file makes a network request at run time, stop and ask the owner instead of rebuilding or patching them

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Settings, database access, schema runner, test runner and the shared API wrapper that every story uses

**CRITICAL**: No user story work can begin until this phase is complete

- [X] T007 Implement `src/server/config.ts`: read `DATABASE_URL` from `process.env`, throw `Error("Missing setting: DATABASE_URL")` when missing or empty, never include any value in a message; export a function that returns the settings; imported by `scripts/migrate.ts`, so it uses `.ts` import extensions, erasable-only syntax and no path aliases (research R1, R3, FR-018)
- [X] T008 Implement `src/server/db.ts`: a lazily created postgres.js client built from `src/server/config.ts`, exported for server code (research R2)
- [X] T009 Implement `applyMigrations(sql, folder)` in `src/server/migrations.ts`: `create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())`; treat a missing or empty folder as nothing pending; list `*.sql` files in name order; for each file without a row, run its SQL and insert its row in one transaction; stop at the first failure and throw an error naming the failing file; ignore rows whose file no longer exists; return the names applied; imported by `scripts/migrate.ts`, so it uses `.ts` import extensions, erasable-only syntax and no path aliases (research R1, R2, data-model.md "schema_migrations")
- [X] T010 Implement `scripts/prepare-test-db.ts` as Vitest global setup: load `.env.local` with `process.loadEnvFile` if present; read both `DATABASE_URL` and `TEST_DATABASE_URL` as loaded, before any test override; refuse (throw `Missing setting: TEST_DATABASE_URL`, changing nothing) when `TEST_DATABASE_URL` is missing or empty; `DATABASE_URL` is optional for `npm test` (tests need only `TEST_DATABASE_URL`), so the dev-versus-test guard runs only when `DATABASE_URL` is set and then refuses (throw, changing nothing) when both URLs, parsed with `new URL`, name the same host, port and database name (`localhost`, `127.0.0.1` and `::1` count as the same host; a missing port counts as `5432`), not a raw string comparison; drop and recreate the `public` schema of the test database; run `applyMigrations` against it from `migrations/`; close the connection (research R5, FR-004)
- [X] T011 Create `vitest.config.ts`: load `.env.local` with `process.loadEnvFile` if present; set `DATABASE_URL` to `TEST_DATABASE_URL` only for the test worker processes through Vitest's `test.env` (never by assigning to `process.env` in `vitest.config.ts`, so T010's guard still sees both original values); `globalSetup: scripts/prepare-test-db.ts`; two inline projects, each with `extends: true` so it inherits the root `test` options (including `env`, so every worker gets `DATABASE_URL` equal to `TEST_DATABASE_URL`): `unit` (`src/**/*.test.ts`, `environment: "node"`) and `components` (`src/**/*.test.tsx`, `environment: "jsdom"`, CSS Modules processed so computed styles can be read by setting `css: { include: [/\.module\.css$/] }` in this project (Vitest does not process CSS by default), `setupFiles: ["scripts/setup-components.ts"]`, a project file that calls `cleanup` from `@testing-library/react` in `afterEach` so rendered trees never leak between tests); JSX through Vitest's built-in transform with the automatic runtime (research R4, R5)
- [X] T012 Implement `src/server/api.ts`: `class ApiError(status, message, fields?)` and `apiRoute(handler)` that times the request, returns the handler's response, turns a thrown `ApiError` into `{ "error": { "message", "fields"? } }` with its status, turns any other throw into `500` `{ "error": { "message": "Something went wrong." } }` plus a separate stdout line `{"time","level":"error","method","path","error":"<error name>"}`, and writes exactly one stdout line per request `{"time":"<ISO UTC>","method","path","status","durationMs"}` where `path` is `new URL(request.url).pathname` and headers, cookies and bodies are never read (research R8, R9, contracts/http-api.md, data-model.md)

**Checkpoint**: Foundation ready; user stories can begin

---

## Phase 3: User Story 1 - Start the app from a fresh checkout (Priority: P1) MVP

**Goal**: A developer prepares the database with one command, starts the app and sees the Tracklite app shell; a missing setting stops start-up and names it.

**Independent Test**: quickstart.md section 1: `npm ci`, copy `.env.example` to `.env.local`, `npm run db:migrate` twice (second run applies nothing, exit 0), `npm run dev`, open `/` and see "Tracklite" in the sidebar, no project entries, empty main area, tab title "Tracklite"; remove `DATABASE_URL` and `npm run build && npm start` exits 1 with `Missing setting: DATABASE_URL`.

### Tests for User Story 1

- [X] T013 [P] [US1] Write `src/server/config.test.ts`: a set setting is returned; a missing and an empty `DATABASE_URL` each throw `Missing setting: DATABASE_URL`; the thrown message never contains any other configured value
- [X] T014 [P] [US1] Write `src/server/migrations.test.ts` against the test database, connecting explicitly through `TEST_DATABASE_URL` (the value the worker's `DATABASE_URL` is overridden to) before dropping `public` (reset `public` before each case): files in a temporary folder apply in name order and each gets a `schema_migrations` row; a second run applies nothing; a failing middle file leaves earlier files applied, later files unattempted, no row for the failing file, and the error names it; a missing or empty folder applies nothing
- [X] T015 [P] [US1] Write `src/components/AppShell.test.tsx`: renders a navigation region containing "Tracklite" as plain text (not a link) and no project list element (no `ul`, `ol` or `role="list"`; RM-5 adds the list), and a main region containing its children; nothing in the sidebar is focusable
- [X] T059 [P] [US1] Write `src/instrumentation.test.ts` (spy on `process.exit` and stderr, `NEXT_RUNTIME` set to `nodejs`): `register()` with a missing or empty `DATABASE_URL` writes `Missing setting: DATABASE_URL` to stderr and exits with code 1, printing no other configured value; with valid settings it does not exit (FR-018)

### Implementation for User Story 1

- [X] T016 [US1] Implement `scripts/migrate.ts` (the `db:migrate` command): load `.env.local` with `process.loadEnvFile` if present, read settings via `src/server/config.ts`, run `applyMigrations` on `migrations/`, print each applied file name (or that nothing is pending), exit 0 on success, and on failure print the error naming the file to stderr and exit non-zero; runs through Node's type stripping, so it and the files it imports use `.ts` import extensions, erasable-only syntax and no path aliases (research R1, contracts/commands.md)
- [X] T017 [US1] Implement `src/instrumentation.ts` `register()`: in the Node.js runtime only, dynamically import `src/instrumentation-node.ts`, which calls the settings reader from `src/server/config.ts`; on failure write the message to stderr and exit with code 1 (research R3, FR-018)
- [X] T018 [P] [US1] Implement `src/components/AppShell.tsx` and `src/components/AppShell.module.css`: sidebar region with "Tracklite" as plain text and no project list element (RM-5 adds the list; owner answer A3), main region for children; sidebar stacks above the main area at phone width; Hairline tokens only; layout per design.md frames 1a and 1b
- [X] T019 [US1] Implement `src/app/layout.tsx`: import the Hairline tokens stylesheet from `src/hairline/` (and then `src/app/globals.css` if T006 created it), set metadata title "Tracklite" (with a `"%s · Tracklite"` template), wrap children in `AppShell`
- [X] T020 [US1] Implement `src/app/page.tsx` rendering an empty main area at `/`
- [X] T021 [US1] Write `README.md` setup steps: prerequisites (Node.js 24 LTS, npm, PostgreSQL 18 installed locally, e.g. `brew install postgresql@18`, no containers), `createdb tracklite_dev` and `createdb tracklite_test`, copy `.env.example` to `.env.local` and fill both settings, `npm ci`, `npm run db:migrate`, `npm run dev`; point to `package.json` for the scripts instead of copying them (SC-001)

**Checkpoint**: The app runs from a fresh clone and shows the shell (User Story 1 acceptance scenarios 1 to 3)

---

## Phase 4: User Story 2 - Check every change with standard commands (Priority: P1)

**Goal**: `npm run build`, `npm test` and `npm run lint` exist, pass on the skeleton and fail on a defect of their kind; AGENTS.md points agents to them.

**Independent Test**: quickstart.md section 2: all three commands exit 0 on a clean checkout; a failing assertion, an unused variable and a type error each make the matching command exit non-zero naming the problem; `TEST_DATABASE_URL` naming the same database as `DATABASE_URL` (same parsed host, port and database name) makes `npm test` refuse and change nothing.

### Implementation for User Story 2

- [X] T022 [US2] Write `AGENTS.md`: point to the `package.json` scripts for build, test and lint (without copying them), `README.md` for setup, `docs/tracklite-spec.md`, `ROADMAP.md`, `.specify/memory/constitution.md` and `specs/`; state that schema changes are new SQL files in `migrations/` applied in name order, each working with the previous release's code (OPS-004), and never edited, renamed or deleted once applied (FR-003, FR-005)
- [X] T023 [US2] Run `npm run build`, `npm test` and `npm run lint` from the repository root and fix every failure in the files that cause it until all three exit 0; confirm `npm run build` leaves `tsconfig.json` unchanged (`git diff --exit-code tsconfig.json`)
- [X] T024 [US2] Verify each command fails on a deliberate defect of its kind (failing assertion → `npm test`; unused variable → `npm run lint`; type error → `npm run build`) and that `npm test` refuses when `TEST_DATABASE_URL` names the same database as `DATABASE_URL` (also when written differently, e.g. `localhost` versus `127.0.0.1`), proving T010's guard reads both values before T011's worker override, and leaves the development database unchanged; that with `DATABASE_URL` unset `npm test` still runs, and with `TEST_DATABASE_URL` unset it refuses with `Missing setting: TEST_DATABASE_URL`; with a temporary test in each project (`unit` and `components`), confirm a test worker sees `DATABASE_URL` equal to `TEST_DATABASE_URL`, not the development URL; then revert every deliberate change (quickstart.md section 2, SC-002)

**Checkpoint**: Every later task and slice can be verified with the three standard commands

---

## Phase 5: User Story 3 - Shared screen states later slices reuse (Priority: P2)

**Goal**: Not found page inside the shell, and the shared loading, empty, load error with Retry, field error and toast pieces, each proven by a component test that renders it directly.

**Independent Test**: `npm test` runs the component tests below and they pass; by hand, `/nothing-here`, `/issue/WEB-999` and `/project/NOPE` on the dev server show "Not found" inside the shell with a "My issues" link, HTTP `404`, title "Not found · Tracklite" (quickstart.md section 3).

### Tests for User Story 3

- [X] T025 [P] [US3] Write `src/app/not-found.test.tsx`: rendered inside `AppShell`, shows heading "Not found" and a link "My issues" with `href="/my-issues"`; after a client-side navigation the "Not found" heading has focus, and on a full page load it does not (focus stays at the browser default), using the client child mechanism of research R13; simulate each case in jsdom by stubbing `performance.getEntriesByType`, with `vi.spyOn(performance, "getEntriesByType")` when it exists, otherwise with `vi.stubGlobal` or `Object.defineProperty` (jsdom may lack it): a navigation entry whose `name` equals `window.location.href` is a full page load, an entry with a different URL is a client-side navigation (design.md "Keyboard and focus")
- [X] T026 [P] [US3] Write `src/components/Loading.test.tsx` with Vitest fake timers: nothing rendered at 300 ms; at 301 ms an element with `role="status"` and `aria-label="Loading"`; unmounted at or before 300 ms never renders it
- [X] T027 [P] [US3] Write `src/components/EmptyState.test.tsx`: shows "No issues yet. Create one." as plain text with no link or button
- [X] T028 [P] [US3] Write `src/components/LoadError.test.tsx` with a small test-file host using `useLoad` and `vi.stubGlobal("fetch", …)`: a load that settles within 300 ms never shows the loading indicator; a non-2xx answer (e.g. `404`, `500`) and a rejected fetch each give state `"error"` and show "Couldn't load this." and a "Retry" button; Retry refetches while the state stays `"error"` (the Retry button stays mounted and no loading indicator appears during the retry); a successful retry shows the content; after a second failure focus is still on Retry; focus after a successful retry is the host page's job and is not asserted (contracts/ui-routes.md, "Focus owned by host pages")
- [X] T029 [P] [US3] Write `src/lib/save.test.ts` with a stubbed `fetch`: `2xx` → `{ ok: true, data }`; `422` with `error.fields` → `{ ok: false, fields }`; `403` → `{ ok: false, toast: "You don't have permission to do that." }`; `400`, `401`, `404`, `409`, `5xx`, a rejected fetch and a `422` without `fields` → `{ ok: false, toast: "Couldn't save. Try again." }` (contracts/ui-routes.md)
- [X] T030 [P] [US3] Write `src/components/FieldError.test.tsx` with a test-file Name form (Hairline TextInput labelled "Name", Hairline primary Button "Save") and a stubbed `fetch` answering `422` `{ "error": { "message": "…", "fields": { "name": "Enter a name." } } }`: after Save, "Enter a name." shows under the field, the field has `aria-invalid="true"` and `aria-describedby` pointing to the message, any typed text is kept (focusing the field is the host page's job and is not asserted, contracts/ui-routes.md); the message's computed style has `overflow-wrap: anywhere`, no `white-space: nowrap` and no `text-overflow: ellipsis`, and its full text is present; with the test-file form inside `ToastProvider` showing `saveJson`'s `toast` through `useToast`, type in the Name field, then stub a `500` and, separately, a `403`: after Save the toast shows "Couldn't save. Try again." and "You don't have permission to do that." respectively, and the typed text stays in the field
- [X] T031 [P] [US3] Write `src/components/Toast.test.tsx` with fake timers and a test-file consumer of `useToast` inside `ToastProvider`: "Couldn't save. Try again." and "You don't have permission to do that." appear in one `aria-live="polite"` region in order of appearance; focus stays on the element focused before; each toast is gone 5 s after it appeared (raise the second 1 s after the first and check each disappearance separately); no button inside a toast; each toast's computed style has `overflow-wrap: anywhere`, no `white-space: nowrap` and no `text-overflow: ellipsis`

### Implementation for User Story 3

- [X] T032 [P] [US3] Implement `src/app/not-found.tsx` and `src/app/not-found.module.css`: metadata title "Not found", heading "Not found" (focusable with `tabIndex={-1}`), link "My issues" to `/my-issues`, and the small client child component of research R13, `src/app/NotFoundFocus.tsx`, that focuses the heading only after a client-side navigation, not on a full page load; keep the `metadata` export only after verifying against the Next.js 16 docs that `not-found` supports it, otherwise stop and ask the owner how the title is set (research R13); the "My issues" link and the focusable heading get a visible focus style from Hairline tokens; confirm Hairline Button has a visible focus style, and if it has none, add one from Hairline tokens in the project wrapper (T006), never in `src/hairline/`; layout per design.md frames 1c and 1d
- [X] T033 [P] [US3] Implement `src/components/Loading.tsx` as a client component (`"use client"`) and `src/components/Loading.module.css`: renders nothing until more than 300 ms have passed (nothing at 300 ms, shown at 301 ms), then `<div role="status" aria-label="Loading">`; timer cleared on unmount (plan.md "Design notes")
- [X] T034 [P] [US3] Implement `src/components/EmptyState.tsx` and `src/components/EmptyState.module.css`: takes the message as a prop and renders it as plain text
- [X] T035 [US3] Implement `useLoad(url)` in `src/lib/load.ts`: returns `{ state: "loading" | "loaded" | "error", data, retry }`; any non-2xx answer or rejected fetch gives `"error"`; `retry` refetches while keeping the state `"error"` until the new result arrives (never back to `"loading"`) (contracts/ui-routes.md)
- [X] T036 [US3] Implement `src/components/LoadError.tsx` as a client component (`"use client"`) and `src/components/LoadError.module.css`: "Couldn't load this." and a Hairline secondary Button "Retry" calling `onRetry`; it stays mounted during a retry (T035), so focus stays on Retry after a failed retry; no busy or disabled Retry state; it never moves focus itself (plan.md "Design notes", design.md frame 1e)
- [X] T037 [P] [US3] Implement `saveJson(url, body)` in `src/lib/save.ts`: POSTs JSON and returns the results listed in T029; never touches form state
- [X] T038 [P] [US3] Implement `src/components/FieldError.tsx` and `src/components/FieldError.module.css`: props field id and message; renders the message with an id the field references via `aria-describedby`; text wraps, never truncates (`overflow-wrap: anywhere` in its CSS) (design.md frames 1f, 1l)
- [X] T039 [US3] Implement `src/components/Toast.tsx` as a client component (`"use client"`) and `src/components/Toast.module.css`: `ToastProvider` rendering one persistent `aria-live="polite"` region and `useToast()` returning `showToast(text)`; toasts stack in order, wrap their text (`overflow-wrap: anywhere` in their CSS), have no controls, never take focus, and each is removed 5 s after it appears; region spans the width with 12 px margins at phone width (design.md frames 1h to 1k)
- [X] T040 [US3] Update `src/app/layout.tsx` to wrap the app in `ToastProvider` so every page shares one toast region

**Checkpoint**: All STD-3, STD-4, STD-7 and STD-9 pieces exist and are proven by component tests (SC-003)

---

## Phase 6: User Story 4 - Operable and safe from day one (Priority: P2)

**Goal**: `/health` reports database state within 1 s, every API request logs one safe JSON line, no secret is in the repository or logs, and times show in the viewer's zone.

**Independent Test**: quickstart.md section 4 (`/health` with the database up and stopped; `/api/nope?token=abc123` with a cookie logs only the path; `npm test` output has no `abc123`, `secret` or `token=`; `git grep` finds no `.env.local` value and `git check-ignore .env.local` prints it) plus the unit and component tests below.

### Tests for User Story 4

- [X] T041 [P] [US4] Write the logging cases in `src/server/api.test.ts` (spy on stdout with an implementation that swallows the output, so logged lines never reach the test run's output; keep the secret literals `abc123`, `secret` and `token=` out of test names): one JSON line per request with `time` (ISO UTC), `method`, `path`, `status`, `durationMs`; a request to `/api/x?token=abc123` with `Authorization`, `Cookie` headers and a JSON body logs `path` `/api/x` and the line contains none of the token, header, cookie or body values; an unexpected throw logs the timing line with status `500` and a separate `level: "error"` line holding only the error name (no message or stack); this per-request assertion (exactly one timing line per API request, no secrets) is the proof of SC-005
- [X] T042 [P] [US4] Write `src/server/health.test.ts`: a succeeding query → `200` `{"status":"ok"}`; a failing query → `503` `{"status":"unavailable"}`; a query that never settles → `503` within 1 s (800 ms limit); bodies carry no detail
- [X] T043 [P] [US4] Write `src/lib/time.test.ts`: `formatTime("…T02:00:00Z", "Asia/Bangkok")` is "09:00"; 24-hour output (e.g. 15:00 UTC in UTC is "15:00"); an invalid zone falls back to UTC
- [X] T044 [P] [US4] Write `src/components/LocalTime.test.tsx` with the process zone set to `Asia/Bangkok`: renders `<time dateTime="…T02:00:00Z">` whose text is "09:00" with no zone label; with the browser's resolved zone missing (undefined), the text is the UTC time
- [X] T060 [P] [US4] Write `src/server/env-files.test.ts`: runs `git check-ignore` (without `-v`) from the repository root and asserts `.env.local` is ignored (exit 0) and `.env.example` is not (exit 1, read from the exit status as the expected result, not treated as an error; any other status fails) (FR-017)
- [X] T061 [P] [US4] Write `src/app/health/route.test.ts`: call the exported `GET` with a `Request` for `/health` against the test database (stdout spied and swallowed as in T041) and assert `200` `{"status":"ok"}` and exactly one log line for the request; if `src/server/db.ts` can be stubbed with `vi.mock` so the query fails, also assert `503` `{"status":"unavailable"}` with exactly one log line (contracts/http-api.md, FR-015, FR-019)

### Implementation for User Story 4

- [X] T045 [US4] Implement `src/server/health.ts`: `checkHealth(query)` runs the given query (default `select 1` via `src/server/db.ts`) with an 800 ms limit and returns a `200` `{"status":"ok"}` or `503` `{"status":"unavailable"}` response (research R10)
- [X] T046 [US4] Implement `src/app/health/route.ts`: `GET` wrapped in `apiRoute`, calling `checkHealth`, with `dynamic = "force-dynamic"` and no caching (contracts/http-api.md)
- [X] T047 [P] [US4] Implement `formatTime(iso, timeZone)` in `src/lib/time.ts` using `Intl.DateTimeFormat` with `hourCycle: "h23"`, `HH:mm` output, and UTC on `RangeError` (research R11)
- [X] T048 [US4] Implement `src/components/LocalTime.tsx` as a client component: renders `<time dateTime={iso}>` and fills its text after mount with `formatTime(iso, <browser zone>)`, passing `"UTC"` when the browser's resolved zone is missing or undefined so `Intl` never falls back to the host default; the server's zone never shows (research R11)
- [X] T049 [US4] Add to `AGENTS.md`: every timestamp column is `timestamptz` written in UTC (DATA-003); tokens never go in path segments because only the path is logged (SEC-007); secrets live only in the git-ignored `.env.local` (OPS-006)
- [x] T050 [US4] Run the quickstart.md section 4 checks: `/health` checked 10 times with the database up (10/10 `200`) and 10 times with it stopped (10/10 `503`), each within 1 s; start the app with PostgreSQL stopped and confirm it starts and `/health` answers `503` (in RM-1 only this half of the spec's "database unreachable at start" edge case applies; pages showing Retry applies from the first slice with a data page, owner answer A2); the logged line for `/api/nope?token=abc123` holds only the path, the JSON log lines of `npm test` output (`grep '^{"time"'`) contain no `abc123`, `secret` or `token=` (T041's per-request assertion, exactly one timing line per API request with no secrets, is the proof of SC-005; the grep alone could pass trivially), `git grep -F` finds no `.env.local` value, `git check-ignore .env.local` prints the file (SC-004 to SC-006)

**Checkpoint**: Health, logging, secret handling and time display are in place and tested

---

## Phase 7: User Story 5 - One API convention for every endpoint (Priority: P3)

**Goal**: Unknown `/api/…` paths answer `404` JSON; `401`, `403`, `404`, `422` (per field) and `500` share one error shape; creates carry a client `requestId` by convention.

**Independent Test**: `npm test` runs the cases below; `curl -i http://localhost:3000/api/nothing` answers `404` `{"error":{"message":"Not found"}}` (quickstart.md section 5).

### Tests for User Story 5

- [x] T051 [US5] Write the error-shape cases in `src/server/api.test.ts`: handlers throwing `ApiError(401, …)`, `ApiError(403, "You don't have permission to do that.")`, `ApiError(404, "Not found")` answer those statuses with `{ "error": { "message" } }`; `ApiError(422, …, { name: "Enter a name." })` answers `422` with `error.fields.name`; any other throw answers `500` `{ "error": { "message": "Something went wrong." } }` with no stack or internal detail; responses are JSON
- [x] T052 [P] [US5] Write `src/app/api/[[...path]]/route.test.ts`: `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD` and `OPTIONS` to an unknown `/api/…` path, to bare `/api` and to `/api/` each answer `404` with JSON `{ "error": { "message": "Not found" } }` and write exactly one timing log line (stdout spied and swallowed as in T041) (contracts/http-api.md)

### Implementation for User Story 5

- [x] T053 [US5] Implement `src/app/api/[[...path]]/route.ts` (optional catch-all, so bare `/api` and `/api/` also match): export `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD` and `OPTIONS` handlers wrapped in `apiRoute` that throw `ApiError(404, "Not found")` (research R8)
- [X] T054 [US5] Add to `AGENTS.md`: every route handler lives under `src/app/api/…/route.ts`, uses resource-style plural paths and JSON, is wrapped in `apiRoute`, and raises `401`/`403`/`404`/`422` by throwing `ApiError`; every create (`POST`) body carries a browser-generated `requestId` (`crypto.randomUUID()`) that the server stores under a unique constraint and uses to answer repeats with the row already created (FR-013, contracts/http-api.md)

**Checkpoint**: Every later endpoint gets STD-1 to STD-4 answers, the log line and the `500` guard from one wrapper

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Constitution compliance and full validation

- [X] T055 [P] Check every file under `src/` (except the vendored third-party files in `src/hairline/`, which are not edited; owner answer C1; the project-written `src/components/hairline.ts` and any wrapper are checked), `scripts/` and the config files for code comments and remove any (Constitution III)
- [X] T056 [P] Check `package.json` lists only the packages approved in constitution IV (v1.4.0) and listed in plan.md "Resolved owner decisions" and that no export used by neither app code nor tests, no unused file, fixture page or test-only route ships in `src/` (the unused-file check also applies to the vendored `src/hairline/`: every vendored file is imported or referenced by the app); the shared pieces for FR-008 to FR-010 and FR-014 count as used when their tests use them (Constitution II, IV; plan.md owner answer C1)
- [X] T057 Run `npm run build`, `npm test` and `npm run lint`; all three exit 0
- [X] T058 Run quickstart.md sections 1 to 5 end to end on a fresh clone, including the by-hand Not found checks (HTTP `404`, title "Not found · Tracklite", and, using the keyboard only, a visible focus style on the "My issues" link, the focused "Not found" heading after an in-app navigation, and a Hairline Button) and a by-hand check in the browser performance panel, on broadband with a warm cache, that `/` and the Not found page are usable within 1.5 s (SC-001, SC-007; NFR-002)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies; T001 first (other setup files need the installed packages to be checked). T006 may stop the feature (Q4 stop condition).
- **Foundational (Phase 2)**: depends on Setup; blocks all user stories. Order: T007 → T008 → T009 → T010 → T011; T012 after T007.
- **US1 (Phase 3)**: depends on Foundational.
- **US2 (Phase 4)**: depends on US1 (the commands must pass on a skeleton that includes the shell and migration command).
- **US3 (Phase 5)**: depends on Foundational and on US1's `AppShell` and `src/app/layout.tsx` (T018, T019).
- **US4 (Phase 6)**: depends on Foundational; T049 depends on T022 (AGENTS.md exists).
- **US5 (Phase 7)**: depends on Foundational; T051 edits the same file as T041 (run after it); T054 depends on T022.
- **Polish (Phase 8)**: depends on all stories.

### Within Each User Story

- Tests are written with the code they cover, in the same phase or the next.
- Hooks and helpers (`useLoad`, `saveJson`, `formatTime`, `checkHealth`) before the components or routes that use them.
- Edits to the same file (`src/app/layout.tsx`, `AGENTS.md`, `src/server/api.test.ts`) run in task order.

### Story completion order

Setup → Foundational → US1 (MVP) → US2 → then US3, US4 and US5 in any order or in parallel → Polish.

## Parallel Example: User Story 3

```text
T025 not-found.test.tsx   T026 Loading.test.tsx     T027 EmptyState.test.tsx
T028 LoadError.test.tsx   T029 save.test.ts         T030 FieldError.test.tsx
T031 Toast.test.tsx
then
T032 not-found.tsx        T033 Loading.tsx          T034 EmptyState.tsx
T037 save.ts              T038 FieldError.tsx
then T035 → T036, T039 → T040
```

## Parallel Example: User Story 4

```text
T041 api.test.ts (logging)   T042 health.test.ts   T043 time.test.ts   T044 LocalTime.test.tsx
T060 env-files.test.ts       T061 health/route.test.ts
then T045 → T046, T047 → T048
```

## Implementation Strategy

### MVP first (User Story 1)

1. Phase 1 Setup (check the Hairline stop condition in T006 early).
2. Phase 2 Foundational.
3. Phase 3 US1: the app runs from a fresh clone and shows the shell. Stop and validate with quickstart.md section 1.

### Incremental delivery

1. US2 next, so every later task is verified by the three standard commands.
2. US3, US4 and US5 are independent of each other once US1 and US2 are done; each ends with `npm test` passing.
3. Polish: constitution checks and the full quickstart.md run.
