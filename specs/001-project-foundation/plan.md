# Implementation Plan: Project Foundation

**Branch**: `001-project-foundation` (work stays on `claude/speckit-sdd-orchestrator-aa4295`) | **Date**: 2026-09-30 | **Spec**: [spec.md](./spec.md) | **Design**: [design.md](./design.md) (Frozen 2026-09-30)

**Input**: Feature specification from `specs/001-project-foundation/spec.md`; behavior from `docs/tracklite-spec.md` v0.4; constitution v1.4.0.

**Status**: Planned. Owner decisions Q1 to Q4 are resolved (see "Resolved owner decisions"). No open question blocks implementation; Q4 carries a stop condition that is checked when the Hairline files (including fonts) arrive. Analysis answers C1, C2, A1, A2, A3, U1 to U3 are recorded below and in research.md.

## Summary

RM-1 builds the running skeleton every later slice extends: a single Next.js (TypeScript) app on Node 24 and PostgreSQL 18, with SQL schema changes applied by one project script, the three standard npm commands (build, test, lint), a Vitest test command that prepares and resets a separate test database before each run, AGENTS.md, the app shell and Not found page, the nine shared pieces listed in contracts/ui-routes.md (app shell, loading, empty, load error, `useLoad`, `saveJson`, field error, toast and time display) each proven by a component test that renders it directly (no fixture page, no browser end-to-end tests; DEC-005), one API convention with a shared error shape, one JSON log line per request with the query string dropped, settings read from a git-ignored `.env.local`, and `/health`. UI follows the Frozen design.md with vendored Hairline tokens, fonts, Button and TextInput. Details and alternatives: [research.md](./research.md).

## Technical Context

**Language/Version**: TypeScript 5.x on Node.js 24 LTS (scripts run directly through Node's type stripping)

**Primary Dependencies**: runtime `next` 16 (App Router), `react` 19, `react-dom` 19, `postgres` (postgres.js); Hairline Design System files vendored in `src/hairline/`. All approved (Q1, Q4, constitution IV). `lucide-react` is approved but not added: RM-1 uses no icons (Principle II). Drizzle is not added in RM-1 (Q3).

**Storage**: PostgreSQL 18, local install, no containers; separate development and test databases; one table, `schema_migrations` (data-model.md)

**Testing**: Vitest (unit tests in the Node environment, component tests in jsdom) with `@testing-library/react` and `@testing-library/dom`; no browser end-to-end tests (DEC-005, Q2)

**Target Platform**: Linux VPS in production (RM-2); macOS or Linux for local development; latest two desktop Chrome, Firefox, Safari, Edge (NFR-006)

**Project Type**: Web application (one Next.js project serving pages, `/health` and `/api/…`)

**Performance Goals**: API reads p95 < 300 ms, writes p95 < 500 ms (NFR-003); pages usable within 1.5 s (NFR-002, SC-007); `/health` answers within 1 s (SC-004)

**Constraints**: no package without owner approval (constitution IV); no comments except required tool directives (III), which does not apply to vendored third-party files in `src/hairline/` (owner answer C1); no dead code or test-only pages in the app (II); no containers; no feature flags; logs never hold secrets, tokens, cookies, bodies or member text (SEC-007); no sign-in in RM-1

**Scale/Scope**: 2 pages (shell at `/`, Not found), 1 endpoint (`/health`) plus the `/api` catch-all, 1 table, 9 shared pieces (contracts/ui-routes.md); team of up to about 10 members (spec section 3)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.* Checked against constitution v1.4.0.

| Principle | Pre-design | Post-design | Notes |
|-----------|-----------|-------------|-------|
| I. Simplicity First | Pass | Pass | One Next.js project; no dotenv, logger, validation, date, ORM or migration package where built-ins or a few lines do the job. Shared pieces (`apiRoute`, `useLoad`, `saveJson`, state components) are required by FR-008 to FR-012 for every later slice, not single-use abstractions. The test database is prepared by Vitest's global setup, not a separate command. |
| II. No Dead Code | Pass | Pass | No fixture page, fixture addresses or test-only code ships in the app; example forms exist only inside test files. `lucide-react` and Drizzle are not added until something uses them. The request-ID convention is documented, not coded. The shared pieces built for FR-008 to FR-010 and FR-014 (`Loading`, `EmptyState`, `LoadError`, `useLoad`, `saveJson`, `FieldError`, `useToast`/`ToastProvider`, `LocalTime`) count as used in RM-1: they are required RM-1 deliverables per the roadmap and spec and are verified by their tests (owner answer C1, Principle II). |
| III. No Code Comments | Pass | Pass | No comments in source, config or tests; the only allowed exception is a single-line tool directive if a tool strictly needs one (none planned). Enforced in review. Vendored third-party files in `src/hairline/` are out of scope (owner answer C1): they are neither edited nor checked for comments. |
| IV. Dependency Approval | Pass | Pass | Every package in this plan is approved by constitution IV (v1.4.0), which lists the RM-1 stack and test packages: Q1 (`next`, `react`, `react-dom`, `postgres`, `typescript`, `@types/node`, `@types/react`, `@types/react-dom`, `eslint`, `eslint-config-next`), Q2 (`vitest`, `@testing-library/react`, `@testing-library/dom`, `jsdom`), Hairline (constitution IV). Nothing else is added; `@testing-library/jest-dom`, `@testing-library/user-event` and `@vitejs/plugin-react` are deliberately not used (research R4). |
| V. UI Design Gate | Pass | Pass | design.md is Frozen (re-freeze 2026-09-30); the plan follows its screens, states, copy, component map and focus rules; Hairline tokens, Button and TextInput are used (Q4). |

**Gate result**: PASS before and after design. No violation needs the Complexity Tracking table.

## Design notes carried into implementation

- **Loading indicator accessible name** (from the design review): the loading indicator is a `role="status"` element whose content does not give it an accessible name, so the implementation MUST add `aria-label="Loading"` to it (`<div role="status" aria-label="Loading">`).
- The toast region is a persistent `aria-live="polite"` element rendered once by `ToastProvider` in the root layout so each new toast is announced; toasts have no controls, never take focus, stack in order of appearance, wrap their text, and each disappears 5 s after it appears (STD-9, DEC-006; frames 1h to 1k).
- Retry: `useLoad.retry` keeps the state `"error"` while it refetches, so `LoadError` and its Retry button never unmount during a retry and focus stays on Retry after another failure; no busy or disabled Retry state is added (design.md has none; owner answer U2).
- Focus after Retry success and after a `422` belongs to the host page (owner answer U1): on a successful reload the host moves focus to its reloaded content (a `tabIndex={-1}` container it owns, focused when `useLoad`'s state changes from `"error"` to `"loaded"`); on a `422` the host focuses the invalid field named in `saveJson`'s `fields`. Shared pieces only expose what hosts need (`state`, `fields`, the field id `FieldError` references) and never move focus themselves; their tests do not assert these focus moves (contracts/ui-routes.md).
- Field errors: the message sits under its field, linked by `aria-describedby`; the field gets `aria-invalid="true"`; the message wraps, never truncates (frames 1f, 1l). The host form keeps the typed text.
- Not found: the heading takes focus after an in-app (client-side) navigation, not on a full page load (design.md, Keyboard and focus); a small client child component of `not-found.tsx` decides this (research R13).
- Component map (Hairline): Button and TextInput are imported through the project's typed entry `src/components/hairline.ts`. If either does not pass through `id`, `aria-invalid`, `aria-describedby`, `value`, `onChange` or the Button variants, or Button has no visible focus style, a thin wrapper in `src/components/` adds it from Hairline tokens; vendored files stay unpatched (owner answer F7). The "My issues" link and the focusable "Not found" heading get a visible focus style from Hairline tokens.
- FieldError and toast text use `overflow-wrap: anywhere`.
- App shell sidebar in RM-1 renders "Tracklite" only and no project list element; RM-5 adds the list (owner answer A3).
- Database unreachable at start (spec edge case): in RM-1 only "the app starts and `/health` answers `503`" applies; the "pages show Retry" half applies from the first slice with a data page (owner answer A2). spec.md is unchanged.
- Time display: 24-hour `HH:mm`, no zone label; UTC when the browser's zone is missing or invalid (design open question 6).
- Phone width: the sidebar stacks above the main area (design open question 5); the toast region spans the width with 12 px margins (frame 1k).
- Copy is exactly design.md's Copy table. The Name form strings ("Name", "Save", "Enter a name.") appear only in test files, as design examples. No string is invented in code except API error messages the UI never shows (`"Not found"`, `"Something went wrong."`).

## Implementation outline

1. Scaffold `package.json` (scripts per contracts/commands.md, `"type": "module"`, `engines.node >= 24`), `tsconfig.json` (`strict`, `allowImportingTsExtensions`, `erasableSyntaxOnly`, `verbatimModuleSyntax`, `noEmit`, plus Next.js's mandatory values up front so a build never rewrites it; files that `scripts/migrate.ts` imports use `.ts` import extensions, erasable-only syntax and no path aliases so Node's type stripping runs them, R1), `next.config.ts`, `eslint.config.mjs` (ignores `src/hairline/`, R6), `vitest.config.ts` (two inline projects with `extends: true`: `unit` in Node, `components` in jsdom with `scripts/setup-components.ts` calling RTL `cleanup`; global setup; test settings, R4 and R5), `.env.example`.
2. Server: `src/server/config.ts` (R3), `src/instrumentation.ts` start-up check, `src/server/db.ts` (lazy postgres.js client), `src/server/api.ts` (`ApiError`, `apiRoute`, log line; R8, R9), `src/server/health.ts` and `src/app/health/route.ts` (R10), `src/app/api/[[...path]]/route.ts` (optional 404 catch-all, also bare `/api`).
3. Schema changes: `src/server/migrations.ts` (runner, R2), `scripts/migrate.ts` (the `db:migrate` command), `scripts/prepare-test-db.ts` (Vitest global setup, R5). RM-1 adds no migration file; the runner treats a missing or empty `migrations/` folder as nothing pending, and the first slice with a table creates it.
4. UI: `src/hairline/` (vendored with its font files, Q4), `src/components/hairline.ts` (project-written typed entry, plus thin wrappers only if needed, F7), `src/app/globals.css` only if the vendored stylesheet references remote font URLs (the app's own `@font-face` rules serving the local fonts, A1), `src/app/layout.tsx` (AppShell, ToastProvider, Hairline styles), `src/app/page.tsx`, `src/app/not-found.tsx` (with its client focus child, R13), `src/components/` shared pieces (contracts/ui-routes.md), `src/lib/time.ts`, `src/lib/load.ts`, `src/lib/save.ts`. Styles are CSS Modules using Hairline tokens only.
5. Tests (all run by `npm test`): unit tests beside the code (`*.test.ts`) for config, `register()` refusing to start (exit 1), `.env.local` git-ignored and `.env.example` not, API wrapper (every status code, log line, query dropped, no headers/cookies/body, `500` guard), `/api` catch-all (including bare `/api`), `/health` route (one log line), migration runner (order, rerun no-op, failure stops and names the file), health (ok, failure, hang), `formatTime` (UTC+7, invalid zone), `saveJson` (`422` with and without `fields`, `403`, `400`, `401`, `404`, `409`, `5xx`, network). Component tests (`*.test.tsx`, jsdom) for AppShell (no project list element), Not found (heading focus after a client-side navigation only, R13), Loading (not before 300 ms, then `role="status"` with `aria-label="Loading"`), EmptyState, LoadError with Retry (reload; state stays `"error"` during a retry so focus stays on Retry after another failure; non-2xx and rejected fetch give `"error"`), FieldError (message, `aria-*`, `overflow-wrap: anywhere`, text kept, also after a `500` or `403` toast), Toast (5 s, stacking, no focus change, `aria-live`, `overflow-wrap: anywhere`), LocalTime ("09:00" for `02:00Z` on UTC+7).
6. Docs: `README.md` setup steps (prerequisites, databases, `.env.local`, commands); `AGENTS.md` pointing to `package.json` scripts, `README.md`, `docs/tracklite-spec.md`, `ROADMAP.md`, `.specify/memory/constitution.md` and `specs/`, and stating: schema changes are new SQL files in `migrations/` that work with the previous release's code (OPS-004) and are never edited once applied; timestamps are `timestamptz` in UTC; tokens never go in path segments; every route handler uses `apiRoute`; creates carry `requestId`.

## Project Structure

### Documentation (this feature)

```text
specs/001-project-foundation/
├── spec.md
├── design.md            # Frozen UI design
├── plan.md              # This file
├── research.md          # Phase 0
├── data-model.md        # Phase 1
├── quickstart.md        # Phase 1
├── contracts/
│   ├── http-api.md
│   ├── ui-routes.md
│   └── commands.md
├── checklists/
│   ├── ops-api.md
│   └── requirements.md
└── tasks.md             # Phase 2 (/speckit-tasks)
```

### Source Code (repository root)

```text
package.json
tsconfig.json
next.config.ts
eslint.config.mjs
vitest.config.ts
.env.example
AGENTS.md
README.md
migrations/                       # ordered *.sql schema changes (created by the first slice with a table)
scripts/
├── migrate.ts                    # db:migrate command
├── prepare-test-db.ts            # Vitest global setup: reset and migrate the test database
└── setup-components.ts           # components project setup: RTL cleanup after each test
src/
├── instrumentation.ts            # start-up settings check
├── instrumentation.test.ts
├── app/
│   ├── layout.tsx                # AppShell, ToastProvider, Hairline styles
│   ├── globals.css               # only if needed: @font-face for the local Hairline fonts (A1)
│   ├── page.tsx                  # empty shell at /
│   ├── not-found.tsx
│   ├── not-found.module.css
│   ├── not-found.test.tsx
│   ├── NotFoundFocus.tsx         # client focus child of not-found.tsx (R13)
│   ├── health/route.ts
│   ├── health/route.test.ts
│   ├── api/[[...path]]/route.ts
│   └── api/[[...path]]/route.test.ts
├── components/                   # AppShell, Loading, EmptyState, LoadError, FieldError, Toast, LocalTime, with *.test.tsx beside each; any thin Hairline wrapper
│   └── hairline.ts               # project-written typed Hairline entry
├── hairline/                     # vendored third-party Hairline files only, and only those the app imports or references: tokens, fonts (weights in use), Button, TextInput and their CSS (Q4); excluded from lint and the comment check (C1, C2), not from the unused-file check (T056)
├── lib/                          # time.ts, load.ts (useLoad), save.ts (saveJson), with tests
└── server/                       # config.ts, db.ts, api.ts, health.ts, migrations.ts, with *.test.ts beside each; env-files.test.ts (checks .gitignore for .env files, not beside one code file)
```

**Structure Decision**: One Next.js project at the repository root (`src/app` for routes, `src/components` and `src/lib` for shared client code, `src/server` for server-only code, `scripts/` for commands and the test setup, `migrations/` for schema changes). Unit and component tests sit beside the code they test. No separate frontend/backend packages and no end-to-end test folder.

## Complexity Tracking

No constitution violations to justify.

## Resolved owner decisions

Recorded as decided by the owner; not re-decided by this plan.

- **Q1 (approved)**: runtime `next`, `react`, `react-dom`, `postgres` (postgres.js); dev `typescript`, `@types/node`, `@types/react`, `@types/react-dom`, `eslint`, `eslint-config-next`.
- **Q2 (approved)**: no browser end-to-end tests (DEC-005). Dev packages `vitest`, `@testing-library/react`, `@testing-library/dom`, `jsdom`. Playwright is not used. Unit and component tests run with Vitest (jsdom for components). Standard commands: build, test, lint only. The test command uses a separate test database that it prepares and resets before each run. The fixture page is dropped; each shared state (loading after 300 ms, empty, load error with Retry, field error including wrapping, toast including stacking, 5 s, no focus change and announcement, time display in 24-hour `HH:mm`) is verified by a component test that renders it directly; Not found is verified by an automated component test.
- **Q3 (approved)**: migrations run through a small project script that applies ordered `migrations/*.sql`, one transaction per file, naming a failing file. `drizzle-orm` and `drizzle-kit` are requested for approval in RM-3, the first slice with a table.
- **Q4 (approved)**: the owner exports the Hairline tokens stylesheet, its font files, `_ds_bundle.js`, Button and TextInput from the "Hairline Design System" Claude Design project, and only the files and font weights the app actually imports or references are vendored into `src/hairline/` (checked in, no network at run time, fonts included: owner answer A1); whole unused files stay out, and the unused-file check (T056, Principle II) applies to `src/hairline/`. Vendored files are never patched. If the vendored stylesheet itself references remote font URLs, the app serves the local fonts through its own `@font-face` rules in its global CSS (`src/app/globals.css`). **Stop condition**: if the bundle does not expose Button and TextInput as React components, makes any network request at run time (for example a CDN icon loader), a font file cannot be exported, or remote font URLs cannot be kept from loading without patching the vendored files, implementation stops and asks the owner rather than rebuilding or patching them. A Button or TextInput that does not pass through a needed prop (`id`, `aria-invalid`, `aria-describedby`, `value`, `onChange`; Button variants) is not a stop condition: the project adds a thin wrapper component outside `src/hairline/` (owner answer F7). The typed entry `src/components/hairline.ts` is project code, outside `src/hairline/`, and is linted and comment-checked. **Owner decisions for T006 (2026-09-30)**, superseding the file list above: `_ds_bundle.js`, `styles.css` and `tokens/fonts.css` are not vendored (`tokens/fonts.css` is the only export file that references remote font URLs, `fonts.googleapis.com`). Vendored byte-for-byte, unpatched, into `src/hairline/` with the export's sub-folder layout: `components/buttons/Button.jsx`, `Button.d.ts`, `buttons.css`; `components/forms/TextInput.jsx`, `TextInput.d.ts`, `forms.css`; `tokens/colors.css`, `tokens/typography.css`, `tokens/spacing.css`, `tokens/base.css` (none of these files import each other). Fonts come from the owner-provided official Google Fonts zip, which has only TTF and no conversion tool is approved, so TTF is vendored as-is: `fonts/Inter/Inter-VariableFont_opsz,wght.ttf` (non-italic, opsz + wght, used 400 to 700), `fonts/JetBrains_Mono/JetBrainsMono-Regular.ttf` (400) and `JetBrainsMono-Medium.ttf` (500), plus each family's `OFL.txt`; nothing else from the zip. `src/app/globals.css` holds the app's `@font-face` rules (`format("truetype")`, `font-display: swap`, families "Inter" and "JetBrains Mono" as named by `tokens/typography.css`), so no font loads from the network and nothing in the app references `fonts.googleapis.com`. `src/components/hairline.ts` re-exports `Button` and `TextInput`; their prop types are re-exported by the first slice that needs them (Principle II); no wrapper is needed (both pass `id`, `aria-*`, `value`, `onChange` through `...rest`; Button has `primary` and `secondary` variants and a `:focus-visible` outline). The root layout (T019) imports the four token files, `buttons.css`, `forms.css` and then `src/app/globals.css`; until T019 they are not imported anywhere.
- **C1 (owner answer)**: Constitution III (no comments) does not apply to vendored third-party files in `src/hairline/`; the comment check (T055) excludes that folder, and ESLint ignores it (C2, R6).
- **C1 (owner answer, Principle II)**: the shared pieces built for FR-008 to FR-010 and FR-014 (`Loading`, `EmptyState`, `LoadError`, `useLoad`, `saveJson`, `FieldError`, `useToast`/`ToastProvider`, `LocalTime`) count as used under Constitution II in RM-1: they are required RM-1 deliverables per the roadmap and spec and are verified by their tests. The dead-code check (T056) flags only exports used by neither app code nor tests.
- **C2 (owner answer)**: ESLint ignores the vendored `src/hairline/` folder (R6, T004).
- **U1, U2, A2, A3 (owner answers)**: recorded in "Design notes carried into implementation" above.
- **Next request log (owner decision, 2026-10-01)**: `next.config.ts` sets `logging: { incomingRequests: false }`, because Next's built-in dev request log prints full URLs including the query string (FR-016); `apiRoute` stays the only request log (R9).
- **Constitution v1.4.0** (IV) also approves `lucide-react` and the Lucide CDN; RM-1 uses no icons, so neither is added (Principle II).
