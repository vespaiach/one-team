# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

Tracklite is a small issue tracker for one invite-only team (Next.js 16, React 19, React Aria Components, Tailwind CSS 4, PostgreSQL 18 via Drizzle ORM, Vitest, Biome). Product behavior, permissions and UI copy are defined in `docs/tracklite-spec.md`; treat it as the source of truth. Local setup (PostgreSQL, Mailpit, `.env.local`) is in `README.md`.

## Commands

Run from the repository root.

```sh
npm run dev                 # dev server on :3000 (needs Mailpit on :8025 for sign-in emails)
npm test                    # all Vitest tests (unit + components projects)
npx vitest run src/server/members.test.ts          # one file
npx vitest run -t "name of the test"               # by test name
npx vitest run --project unit                      # only *.test.ts (node env)
npx vitest run --project components                # only *.test.tsx (jsdom env)
npm run lint                # biome check (add --write to fix)
npm run typecheck           # next typegen && tsc --noEmit
npm run db:generate         # new migration from changes to src/server/schema.ts
npm run db:migrate          # apply pending migrations to DATABASE_URL
npm run db:seed             # sample data; seeded admin is owner@example.com
```

Testing notes:
- Tests run against a real PostgreSQL database (`TEST_DATABASE_URL` in `.env.local`, which must differ from `DATABASE_URL`). `scripts/prepare-test-db.ts` (Vitest `globalSetup`) drops and recreates the test schema and applies all migrations before every run.
- `unit` project tests run with `fileParallelism: false` because they share that database.
- Vitest aliases `server-only` to its no-op entry, so `src/server` modules can be imported in tests. Scripts in `scripts/` run with `node --conditions=react-server` for the same reason.

## Architecture

**Request flow.** Pages are protected by `src/proxy.ts` (Next 16's replacement for middleware): it validates the session cookie, redirects signed-out users to `/sign-in?next=…`, and sends signed-in users from `/` and `/sign-in` to `/my-issues`. It skips `/api`, `/health` and static assets. Authenticated pages live under the `src/app/(app)/` route group, whose layout calls `requireCurrentMember()` and renders `AppShell`.

**API routes.** Every handler lives in `src/app/api/…/route.ts` (the only exception is `GET /health` in `src/app/health/route.ts`), uses resource-style plural paths and JSON bodies, and is wrapped in `apiRoute` from `src/server/api.ts`. That wrapper:
- rejects cross-site `POST`/`PUT`/`PATCH`/`DELETE` with `403` before the handler runs;
- turns a thrown `ApiError(status, message, fields?)` into `{ error: { message, fields? } }` (and clears the session cookie on a `401`);
- turns any other error into a `500` and writes a structured log line for every request.

Handlers raise `401`, `403`, `404` and `422` by throwing `ApiError`. Every route file exports all of `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD`, `OPTIONS`; the unimplemented ones are `unmatchedRoute` from `src/server/permissions.ts`, so Next never answers a bare `405`. Unmatched `/api` paths hit the catch-all `src/app/api/[[...path]]/route.ts` (`401` signed out, `404` signed in). Every handler except the three sign-in endpoints (`POST /api/sign-in-links`, `POST /api/sessions`, `DELETE /api/sessions/current`) calls `requireMember` (and `requireAdmin` where needed).

**Idempotent creates.** Every create (`POST`) body carries a browser-generated `requestId` (`crypto.randomUUID()`). The server stores it with the created row under a unique constraint and answers a repeat with the row already created. Sign-in-link request IDs live in their own `sign_in_requests` table.

**Server code** (`src/server/`, every module starts with `import "server-only"`): `db.ts` exposes the lazily created `db()` and the `Database`/`Transaction`/`Executor` types; `schema.ts` defines all Drizzle tables; `config.ts` reads settings, and `instrumentation.ts` checks them at server start. Domain functions take the database (or a transaction) as their first argument, which is how tests pass in a test connection.

**Client side.** Pages compose feature code from `src/features/<feature>/` (`components/`, `hooks/`, `services/`). Shared fetch helpers: `useLoad` (`src/hooks/useLoad.ts`) for GETs with retry, and `saveJson` (`src/lib/save.ts`), which maps `403`/`422`/other failures to toast text or field errors. Shared UI is in `src/components/ui` and `src/components/layout`.

**Design system.** UI uses the vendored Hairline design system in `src/components/ui/hairline/`, always imported through its `index.ts`. Use its tokens and components; don't invent colors, fonts or styling. Biome ignores that folder.

## Conventions

- Imports are relative and keep the `.ts`/`.tsx` extension (there is no `@/` alias). Tests sit beside the code they test (`*.test.ts` for node, `*.test.tsx` for jsdom).
- Database access goes through Drizzle's query builder; use the `sql` template only for what it can't express (locks, interval arithmetic, CTEs).
- Schema changes: edit `src/server/schema.ts`, then `npm run db:generate`. A migration must keep working with the previous release's code, and once applied it is never edited, renamed or deleted.
- Every timestamp column is `timestamptz`, written in UTC.
- Never put tokens in URL path segments, because request paths are logged.
- Secrets live only in the git-ignored `.env.local`; `.env.example` holds placeholders.
