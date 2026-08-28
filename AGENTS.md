<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Authority

This file is the primary source for how code is written here: where anything conflicts with a principle below, this file wins. [`.specify/memory/constitution.md`](.specify/memory/constitution.md) holds governance, the amendment procedure, and the version record. [`docs/product/specifications.md`](docs/product/specifications.md) owns **what** is built and [`docs/ROADMAP.md`](docs/ROADMAP.md) owns the `R1`…`R12` decomposition; both are silent on how.

When instructions conflict, follow the user's current request first, then this file, then the most specific remaining repository guidance. Do not silently reinterpret product or architecture decisions.

Principles are cited across the repository by numeral — `Principle IV`, `(V, VI)`, `(VII)` — and change gates by number. Principle numerals I–VII and gate numbers 1–8 are stable; never renumber them.

# Core principles

## I. Component-Driven Architecture

Every user-facing surface MUST be composed from focused components, each owning a single concern; one that takes on unrelated responsibilities MUST be split along them. Shared abstractions MUST NOT be created speculatively — a pattern MUST appear at two call sites before it is extracted into a shared component, hook, or module. Large files MUST be split when size or mixed concerns obscure intent, but splitting MUST stop short of many trivial files. *An abstraction extracted at the first call site guesses a shape the second has not confirmed, and navigation cost is as real as god-file cost.*

## II. Validated Input Boundaries

All user-supplied input MUST be strictly validated and sanitized before it is processed or persisted, at every entry point without exception: form submissions, request bodies, query and route parameters, headers, and any value originating outside the running process. Validation MUST run on the server for every request that reads or writes data, whatever the client also checks. Input that fails validation MUST be rejected with an explicit error; it MUST NOT be silently coerced, truncated, or partially accepted. *Client-side validation is a UX affordance, trivially bypassed, and never a security control.*

## III. Straightforward Over Clever

Implementations MUST prefer straightforward, readable solutions over clever abstractions. Where two satisfy the same requirement, the one a reader understands without tracing indirection MUST be chosen. Indirection, metaprogramming, dynamic dispatch, and generic machinery MUST be justified by a requirement present in the codebase today, never an anticipated one. *Cleverness trades a small authoring convenience for a comprehension cost paid by every later reader.*

## IV. Built-In Features Over Third-Party Libraries

Built-in language, runtime, and framework features MUST be preferred over third-party libraries; before proposing a dependency, contributors MUST establish that no built-in capability of TypeScript, the Node.js runtime, the Web platform, React, or Next.js covers the need. Installing a new third-party dependency MUST NOT occur without explicit team approval recorded beforehand in the approved-dependency table below, and this applies to transitive-weight additions and developer tooling alike. *Every dependency is a permanent liability the team did not choose.*

## V. Intention-Revealing Code Without Comments

Code MUST communicate intent entirely through structure and intention-revealing naming. Inline comments, block comments, and in-body explanations are prohibited; where code is unclear the remedy is renaming, extraction, or restructuring, never annotation. Machine-readable directives the toolchain requires in order to function, such as type checker or linter suppression pragmas, are not explanatory comments and fall outside this prohibition, but each MUST be the minimum scope that resolves the issue. *A comment is an unverified claim that drifts from the code it describes.*

## VI. No Dead Code

Dead code is prohibited: unused imports, variables, functions, types, exports, and unreachable code paths MUST be removed before any commit. Code retained for possible future use MUST be deleted — version control is the mechanism for recovering it. Commented-out code is prohibited under V and is likewise removed rather than preserved. Biome's `noUnusedImports` and `noUnusedVariables` fail `style-check`, so gate 5 enforces most of this mechanically. *Dead code is indistinguishable from live code during review and search.*

## VII. Test-First Development (NON-NEGOTIABLE)

All production code MUST be written using Red-Green-Refactor: a failing test first, then the minimal code that makes it pass, then refactoring while the test stays green. No production code may be written without a corresponding failing test written beforehand, and that test MUST be observed failing for the intended reason before any implementation is written. A test that passes on its first run is not a valid Red step and MUST be corrected before proceeding. *A test written afterwards confirms what the code does, not what it was required to do, and has never been demonstrated to fail.*

# Technology constraints

The stack is Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, and Biome. The table below is the approval record Principle IV requires, and it is the complete set: anything absent needs its own approval, recorded here by amendment before it is installed.

| Dependency | Purpose | Scope |
| --- | --- | --- |
| `drizzle-orm`, `drizzle-kit`, `postgres` | PostgreSQL access, schema and migrations | runtime, tooling |
| `react-aria-components` | Interaction behaviour, focus management, keyboard support and ARIA semantics | runtime |
| `@node-rs/argon2` | Argon2id password hashing | runtime |
| `nodemailer` | Notification mail over operator-supplied SMTP | runtime |
| `uuidv7` | Time-ordered primary keys | runtime |
| `fractional-indexing` | Board ordering index | runtime |
| `@next/env`, `server-only` | Environment loading, server-boundary enforcement | runtime |
| `vitest`, `jsdom`, `@testing-library/react`, `@vitejs/plugin-react` | Test runner and component testing | development |
| `babel-plugin-react-compiler@latest` | React Compiler transform, enabled by `reactCompiler` in `next.config.ts` | development |

`@node-rs/argon2`, `nodemailer`, `uuidv7` and `fractional-indexing` are approved but not yet installed; installing them needs no further approval round.

# Architecture notes

These are not discoverable from a single file, and each one causes wrong code if assumed otherwise.

- **React Compiler is enabled** (`next.config.ts`). Do not hand-write `useMemo`, `useCallback`, or `memo`; the compiler inserts memoization. In exchange the Rules of React are load-bearing: no mutating props or state during render, no conditional hooks.
- **Tailwind CSS v4, configured in CSS.** The theme lives in `@theme inline` inside `src/app/globals.css`, wired through `@tailwindcss/postcss`. There is no `tailwind.config.js`; do not create one.
- **`server-only` enforces the server boundary.** `src/db/index.ts` imports it, so a Client Component that reaches the database fails the build instead of leaking at runtime. Keep that import on new server modules.
- **The schema is a single file**, `src/db/schema.ts`, referenced directly by `drizzle.config.ts`. Splitting it means updating that config in the same change.
- **Locale is resolved on the server and handed to the client.** `src/app/layout.tsx` reads `accept-language` via `await headers()` and sets `lang` and `dir`; `src/app/provider.tsx` passes the same locale to React Aria's `I18nProvider`. Change both together or the server and client will disagree.
- **Only `src/app` and `src/db` exist today.** The structure rules below describe the intended shape, not current fact.

# Structure

Read the relevant route, feature, tests, schema, and configuration before editing.

- `src/app` holds routing, layouts, pages, and route handlers only. Route groups such as `(public)` and `(app)` organize layouts without adding URL segments. Do not turn pages or layouts into domain modules.
- Business behaviour lives in `src/features/<feature>/`, with server-only queries, actions, and services under its `server/` directory. Not in generic utility files.
- Colocate code used by one route or feature. Promote to `src/components/shared` or `src/lib` only after a real second use (I).
- `src/components/ui` holds reusable accessible primitives. They must not import feature, authentication, or database code.
- Client Components must never import database clients, secrets, or arbitrary server-only modules. They may import Server Functions only from a dedicated module marked with top-level `"use server"`.
- Avoid barrel files that mix server and client exports.

# Next.js 16 and the server boundary

- Pages and layouts are Server Components. Add `"use client"` only at the narrowest interactive boundary; everything imported below it joins the client module graph.
- `params`, `searchParams`, `cookies()`, and `headers()` are asynchronous APIs.
- Use Server Actions for this application's mutations; use Route Handlers for public APIs, webhooks, callbacks, and feeds. Every Server Action is a public server entry point: validate input, authenticate, authorize the exact resource, return a safe result (II).
- `proxy.ts` is not authorization. Use it for fast routing or redirects and repeat authorization at the protected server boundary.
- Do not assume a query or `fetch` is cached. Revalidate or invalidate affected data after mutations on cached routes.
- Only `NEXT_PUBLIC_` values reach the browser. Return generic messages to clients and keep SQL, stack traces, and configuration in server logs.

# TypeScript

- No `any`, non-null assertions, `@ts-ignore`, or unsafe casts. If one is genuinely unavoidable, keep it narrow.
- Derive persistence types with `$inferSelect` and `$inferInsert`, but never expose database rows as public API or UI models — define an explicit DTO at the boundary.
- Model expected failures as typed results or domain errors. Reserve thrown errors for exceptional failures and map them at the server boundary.
- A TypeScript type is not runtime validation.

# Drizzle ORM and PostgreSQL 18

- Generate migrations with Drizzle Kit, inspect the generated SQL, and commit the migration plus its metadata.
- Never edit a migration that may already have run in a shared environment; add a new one. Never run `drizzle-kit push` against production.
- Use `timestamp with time zone` for real-world instants and keep application logic in UTC. Use a date type for calendar dates. Use exact numeric types for money.
- Protect concurrency-sensitive invariants with constraints, atomic statements, conflict handling, or locks. A read followed by a write is not protection.
- Never interpolate untrusted input into raw SQL. Keep any raw SQL localized, parameterized, typed, and tested.
- Add indexes for known query patterns only. PostgreSQL does not index the referencing side of a foreign key automatically.

# React Aria Components

Tailwind is the visual layer; interaction behaviour comes from `react-aria-components`. Build a component by hand only where React Aria ships no equivalent, and reproduce the same keyboard, focus, and ARIA behaviour.

- Use `onPress`, not `onClick`. Do not add roles or keyboard handlers to patch around an incorrectly composed component.
- Style interaction state through `data-hovered`, `data-pressed`, `data-selected`, and `data-focus-visible`.
- Every control needs an accessible name, a visible focus indicator, and error text associated with the control. Never convey state or errors through colour alone.
- `@react-aria/test-utils` is not installed; adding it needs approval under IV. Use explicit keyboard events to verify focus order.

# Testing

Vitest is the single runner for server logic and components, with jsdom and `@testing-library/react`. Do not add a test framework (IV).

- **`npm test` runs with `--passWithNoTests`.** Gate 8 goes green on an empty suite, so a passing run is not by itself evidence of VII.
- Persistence tests MUST run against a real PostgreSQL instance on a separate database — invariants are enforced by constraints and row locks, which a mock cannot verify. Never point tests at development, staging, or production data.
- Query by role, label, and visible text before `data-testid`. Avoid snapshots as the only proof of interactive behaviour.
- Cover failure cases, empty and pending states, unauthorized access, invalid input, and concurrent writes.

# Change gates

Every change MUST satisfy these before it is committed. They are cited by number; do not renumber them.

1. A test exists that was written before the implementation and was observed failing (VII).
2. The implementation is the minimal code that makes that test pass, followed by refactoring with the test green (VII).
3. Every input boundary the change touches validates and sanitizes on the server (II).
4. No new third-party dependency was added without recorded team approval (IV).
5. `npm run style-check` passes with no findings.
6. The diff contains no comments, no commented-out code, and no dead code (V, VI).
7. Every changed line traces to the stated requirement; adjacent code is left untouched.
8. `npm test` passes with no failing or skipped tests.

A reviewer who cannot determine from the diff that a test was written first MUST request that evidence before approving. A change that violates a principle needs an approved amendment, not an informal exception.

# Commands

`npm run verify` is the gate: `style-check`, then `type-check`, then `test`, then `build`. CI runs exactly this and nothing else, so green locally means green in CI. `npm run build` alone does not run Biome.

| Task | Command |
| --- | --- |
| Dev server | `npm run dev` |
| Full gate — run before claiming done | `npm run verify` |
| Auto-fix formatting and lint | `npm run fix` |
| Style check only | `npm run style-check` |
| Types only | `npm run type-check` |
| All tests once | `npm test` |
| Watch mode | `npm run test:watch` |
| One test file | `npx vitest run src/path/to/thing.test.ts` |
| One test by name | `npx vitest run -t "rejects an unauthenticated caller"` |
| Generate a migration after editing `src/db/schema.ts` | `npm run db:generate` |
| Apply migrations | `npm run db:migrate` |
| Browse the database | `npm run db:studio` |

Do not report a check as passing unless you ran it and saw it pass.
