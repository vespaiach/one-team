<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Authority and precedence

This file is the primary source for how code is written in this repository. Its **Core principles** section is normative: it supersedes all other development practices, conventions, preferences, and agent defaults. Read it before beginning work.

| Document | Owns | Relationship to this file |
| --- | --- | --- |
| `AGENTS.md` (this file) | The seven core principles; runtime, framework and structure guidance; commands | **Primary.** Where anything conflicts with a principle here, this file wins. |
| [`.specify/memory/constitution.md`](.specify/memory/constitution.md) | Technology Constraints and the approved-dependency table; the eight Development Workflow gates; Governance and the amendment procedure | Cites the principles hosted here; still governs how they are amended, and remains their version record. |
| [`docs/product/specifications.md`](docs/product/specifications.md) | **What** is built — the product source of truth | Silent on how. |
| [`docs/ROADMAP.md`](docs/ROADMAP.md) | Decomposition into `R1`…`R12` and their order | Silent on how. |

When instructions conflict, follow the user's current request first, then this file, then the most specific remaining repository guidance. Do not silently reinterpret product or architecture decisions.

Principles are cited by numeral across the repository — `Principle IV`, `(V, VI)`, `(VII)`. The numerals and names below are stable; never renumber them.

# Project overview

- Framework: Next.js 16.x using the App Router
- Language: TypeScript 7.0 in strict mode
- UI: React, React Aria library, TailwindCss
- Database: PostgreSQL 18
- ORM and migrations: Drizzle ORM and Drizzle Kit
- Formatting and linting: Biome
- Package manager: npm

# Core principles

## I. Component-Driven Architecture

Every user-facing surface MUST be composed from focused components, each owning a single concern; one that takes on unrelated responsibilities MUST be split along them. Shared abstractions MUST NOT be created speculatively — a pattern MUST appear at two call sites before it is extracted into a shared component, hook, or module. Large files MUST be split when size or mixed concerns obscure intent, but splitting MUST stop short of many trivial files. *An abstraction extracted at the first call site guesses a shape the second has not confirmed, and navigation cost is as real as god-file cost.*

## II. Validated Input Boundaries

All user-supplied input MUST be strictly validated and sanitized before it is processed or persisted, at every entry point without exception: form submissions, request bodies, query and route parameters, headers, and any value originating outside the running process. Validation MUST run on the server for every request that reads or writes data, whatever the client also checks. Input that fails validation MUST be rejected with an explicit error; it MUST NOT be silently coerced, truncated, or partially accepted. *The database is the only copy of the data; client-side validation is a UX affordance, trivially bypassed, and never a security control.*

## III. Straightforward Over Clever

Implementations MUST prefer straightforward, readable solutions over clever abstractions. Where two satisfy the same requirement, the one a reader understands without tracing indirection MUST be chosen. Indirection, metaprogramming, dynamic dispatch, and generic machinery MUST be justified by a requirement present in the codebase today, never an anticipated one. *Cleverness trades a small authoring convenience for a comprehension cost paid by every later reader.*

## IV. Built-In Features Over Third-Party Libraries

Built-in language, runtime, and framework features MUST be preferred over third-party libraries; before proposing a dependency, contributors MUST establish that no built-in capability of TypeScript, the Node.js runtime, the Web platform, React, or Next.js covers the need. Installing a new third-party dependency MUST NOT occur without explicit team approval recorded beforehand in the approved-dependency table under Technology constraints below, and this applies to transitive-weight additions and developer tooling alike. *Every dependency is a permanent liability: supply-chain exposure, version drift, bundle weight, and an upgrade obligation the team did not choose.*

## V. Intention-Revealing Code Without Comments

Code MUST communicate intent entirely through structure and intention-revealing naming. Inline comments, block comments, and in-body explanations are prohibited; where code is unclear the remedy is renaming, extraction, or restructuring, never annotation. Machine-readable directives the toolchain requires in order to function, such as type checker or linter suppression pragmas, are not explanatory comments and fall outside this prohibition, but each MUST be the minimum scope that resolves the issue. *A comment is an unverified claim that drifts from the code it describes; naming and structure are checked by the compiler, the linter, and every reader.*

## VI. No Dead Code

Dead code is prohibited: unused imports, variables, functions, types, exports, and unreachable code paths MUST be removed before any commit. Code retained for possible future use MUST be deleted — version control is the mechanism for recovering it. Commented-out code is prohibited under V and is likewise removed rather than preserved. *Dead code is indistinguishable from live code during review and search, so it inflates the apparent surface area of every change and is maintained at real cost.*

## VII. Test-First Development (NON-NEGOTIABLE)

All production code MUST be written using Red-Green-Refactor: a failing test first, then the minimal code that makes it pass, then refactoring while the test stays green. No production code may be written without a corresponding failing test written beforehand, and that test MUST be observed failing for the intended reason before any implementation is written. A test that passes on its first run is not a valid Red step and MUST be corrected before proceeding. *A test written afterwards confirms what the code does, not what it was required to do, and has never been demonstrated to fail.*

# Technology constraints

The stack is Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, and Biome for formatting and linting. Additions to it are dependency decisions governed by Principle IV and require explicit team approval.

The following dependencies are approved under Principle IV. This list is the record that principle requires, and it is the complete set: anything absent from it needs its own approval, recorded here by amendment before it is installed.

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

Tailwind supplies the visual layer only; interaction behaviour comes from React Aria Components. A component is custom-built only where React Aria ships no equivalent, and it MUST reproduce the same keyboard, focus and ARIA behaviour.

The application is server-authoritative: the database is the single copy of the data and every read is a query against it. Principle II is enforced at the server boundary on this basis.

# Architecture notes

These are not discoverable from a single file, and each one causes wrong code if assumed otherwise.

- **React Compiler is enabled** (`next.config.ts`). Do not hand-write `useMemo`, `useCallback`, or `memo`; the compiler inserts memoization. In exchange the Rules of React are load-bearing: no mutating props or state during render, no conditional hooks.
- **Tailwind CSS v4, configured in CSS.** The theme lives in `@theme inline` inside `src/app/globals.css`, wired through `@tailwindcss/postcss`. There is no `tailwind.config.js`; do not create one.
- **`server-only` enforces the server boundary.** `src/db/index.ts` imports it, so a Client Component that reaches the database fails the build instead of leaking at runtime. Keep that import on new server modules.
- **The schema is a single file**, `src/db/schema.ts`, referenced directly by `drizzle.config.ts`. Splitting it means updating that config in the same change.
- **Locale is resolved on the server and handed to the client.** `src/app/layout.tsx` reads `accept-language` via `await headers()` and sets `lang` and `dir`; `src/app/provider.tsx` passes the same locale to React Aria's `I18nProvider`. Change both together or the server and client will disagree.
- Only `src/app` and `src/db` exist today. The structure below is the intended shape, not current fact.

# Working practices

Operational rules that sit under the core principles above. The former entries for smallest-cohesive-change, reuse-before-abstracting, dependency approval and untrusted input are now Principles III, I, IV and II respectively.

1. Read the relevant route, feature, tests, schema, and configuration before editing.
2. Preserve unrelated work. Never rewrite, remove, or reformat unrelated files; every changed line must trace to the stated requirement.
3. Do not claim a check passed unless you ran it and saw it pass.
4. Keep secrets, database access, and authorization logic on the server. `server-only` enforces that boundary — keep the import on new server modules.
5. Approval under Principle IV means an amendment to the approved-dependency table under Technology constraints, recorded before the package is installed.

# Recommended project structure

```text
.
├── drizzle/                     # Generated, committed SQL migrations and metadata
├── public/                      # Static assets
├── src/
│   ├── app/                     # Routing, layouts, pages, route handlers
│   │   ├── (public)/            # Route group for public pages
│   │   ├── (app)/               # Route group for authenticated product pages
│   │   ├── api/                 # HTTP endpoints only when an HTTP API is needed
│   │   ├── globals.css
│   │   └── layout.tsx
│   ├── components/
│   │   ├── ui/                  # Shared, styled React Aria primitives
│   │   └── shared/              # Cross-feature composed components
│   ├── features/
│   │   └── feature-name/
│   │       ├── components/      # Feature-specific UI
│   │       ├── server/          # Server-only queries, actions, and services
│   │       │   ├── actions.ts
│   │       │   ├── queries.ts
│   │       │   └── service.ts
│   │       ├── model.ts         # Domain rules and pure transformations
│   │       └── types.ts         # Feature-owned public types
│   ├── db/
│   │   ├── index.ts             # Drizzle client construction; imports "server-only"
│   │   └── schema.ts            # Tables, constraints, relations, and indexes
│   ├── lib/                     # Small cross-cutting utilities and infrastructure
│   │   ├── env.ts
│   │   └── errors.ts
│   └── test/                    # Shared test setup, factories, and helpers
├── biome.json
├── drizzle.config.ts
├── next.config.ts
├── package.json
└── tsconfig.json
```

## Structure rules

- Keep `src/app` focused on routing and composition. Do not turn pages or layouts into large domain modules.
- Colocate code that is used by only one route or feature. Promote it to `components/shared` or `lib` only after there is a real second use.
- Put reusable, accessible UI primitives in `components/ui`. They must not import feature, authentication, or database code.
- Put business behavior in `features/<feature>`, not in generic utility files.
- Database schema and client setup belong in `db`. Feature-specific queries may live in `features/<feature>/server` and import `db`.
- Client Components must never import database clients, secrets, or arbitrary server-only modules. They may import Server Functions only from a dedicated module marked with top-level `"use server"`.
- Avoid barrel files that mix server and client exports. Import from the owning module when a barrel could blur that boundary.
- Route groups such as `(public)` and `(app)` organize layouts; they do not add URL segments.

# Next.js 16 and App Router

- Pages and layouts are Server Components by default. Keep them server-side unless interactivity, browser APIs, effects, or local state require a Client Component.
- Add `"use client"` only at the narrowest interactive boundary. Everything imported below that boundary joins the client module graph.
- Fetch data in Server Components or server-only feature modules. Pass only minimal, serializable data into Client Components.
- Treat `params`, `searchParams`, `cookies()`, and `headers()` as asynchronous APIs.
- Use Server Actions for mutations initiated by this application. Use Route Handlers for public APIs, webhooks, callbacks, feeds, or endpoints that require HTTP semantics.
- Treat every Server Action as a public server entry point: validate input, authenticate, authorize the exact resource, and return a safe result.
- Do not rely on proxy checks as authoritative authorization. If `proxy.ts` is used, use it for fast routing or redirects and repeat authorization at the protected server boundary.
- Choose caching behavior deliberately. Do not assume a database query or `fetch` call is cached. Revalidate or invalidate affected data after mutations when the route uses caching.
- Use `loading.tsx`, `error.tsx`, and `not-found.tsx` where they materially improve the route experience.
- Do not expose internal errors, SQL, stack traces, or secret configuration to the browser.

# TypeScript

- Keep `strict: true`. Do not weaken compiler options to make a change pass.
- Prefer precise domain types, discriminated unions, and `unknown` at untrusted boundaries.
- Avoid `any`, non-null assertions, `@ts-ignore`, and unsafe type casts. If one is truly unavoidable, keep it narrow and explain why.
- Use `import type` for type-only imports.
- Use `satisfies` when validating an object's shape while preserving inference.
- Derive persistence types from Drizzle with `$inferSelect` and `$inferInsert` when appropriate, but do not expose database rows directly as public API or UI models.
- Model expected failures as typed results or domain errors. Reserve thrown errors for exceptional failures and map them at the server boundary.
- Do not duplicate equivalent domain types merely to avoid importing their owner. Define an explicit DTO or boundary type when trust, serialization, visibility, or lifecycle requirements differ.
- Validate runtime data; a TypeScript type alone is not runtime validation. Reuse the repository's existing validation approach and ask before adding a library.

# Drizzle ORM and PostgreSQL 18

## Schema and migrations

- Generate migrations with Drizzle Kit, inspect the generated SQL, and commit the migration plus its metadata.
- Never edit a migration that may already have run in a shared environment. Add a new migration instead.
- Do not use `drizzle-kit push` against production. Production changes must use reviewed, versioned migrations.
- Prefer backward-compatible expand/migrate/contract changes for live tables.
- Name constraints and indexes when the name improves diagnostics or operations.

## Data integrity

- Every table needs a stable primary key.
- Enforce invariants in PostgreSQL with `NOT NULL`, `UNIQUE`, `CHECK`, and foreign key constraints whenever the database can express them.
- Define foreign-key delete and update behavior explicitly when the default is not the intended domain behavior.
- Remember that PostgreSQL does not automatically index the referencing side of a foreign key. Add an index when the real access or delete/update pattern needs it.
- Use `timestamp with time zone` for real-world instants and keep application logic in UTC. Use a date type for calendar dates that are not instants.
- Use exact numeric types for money or other exact decimal values; do not use floating-point storage for them.

## Queries and transactions

- Select only the columns needed by the caller. Do not return sensitive fields by default.
- Bound list queries and use deterministic ordering. Prefer cursor-based pagination for large or frequently changing datasets.
- Use a transaction when multiple writes must succeed or fail together.
- Protect concurrency-sensitive invariants with database constraints, atomic statements, appropriate conflict handling, or locks. A read followed by a write is not sufficient protection.
- Avoid N+1 queries. Batch or join when it improves the measured access pattern.
- Use Drizzle parameterization. Never interpolate untrusted input into raw SQL.
- Raw SQL is acceptable only when Drizzle cannot express the operation clearly; keep it localized, parameterized, typed, and tested.
- Do not create speculative indexes. Add them for known query patterns and inspect query plans when performance is the reason for the change.

## Database lifecycle

- Use a separate database for automated tests. Never point tests at development, staging, or production data.
- Apply migrations before tests that depend on the schema.
- Keep seeds deterministic and safe to rerun when practical.
- Never log connection strings, credentials, tokens, or sensitive row contents.

# React Aria Components

- Build shared interactive primitives with `react-aria-components` rather than recreating ARIA behavior, focus management, selection, overlays, or keyboard interactions manually.
- Prefer native semantic HTML for simple, non-composite content. Do not add ARIA when native semantics already express the behavior.
- Every control must have an accessible name. Prefer a visible `<Label>`; use `aria-label` or `aria-labelledby` only when a visible label is not appropriate.
- Preserve React Aria's structure and semantics. Do not add roles or keyboard handlers to patch around an incorrectly composed component.
- Use `onPress` for React Aria press interactions. Do not assume mouse-only `onClick` behavior is equivalent.
- Style interaction state through React Aria data attributes or render props such as `data-hovered`, `data-pressed`, `data-selected`, and `data-focus-visible`.
- Provide a visible focus indicator, sufficient contrast and target size, useful error text, disabled and pending states, and reduced-motion behavior.
- Associate descriptions and validation errors with their controls. Do not convey state or errors through color alone.
- Test keyboard, pointer, touch-relevant, focus, dismissal, and screen-reader semantics for interactive patterns.
- Query UI tests by role, label, and visible text before using `data-testid`.
- Use explicit keyboard events when verifying exact focus order or key behavior. `@react-aria/test-utils` is not installed; adding it needs approval under Principle IV.
- Set the document `lang` and `dir` on the server. When locale is configurable, pass the same locale to a client-side `I18nProvider` to avoid server/client mismatch.

# Security and server boundaries

- Validate content type, shape, size, range, and identifiers at every external boundary.
- Expose only intentionally public values with `NEXT_PUBLIC_`. Treat all other environment variables as server-only.
- Avoid open redirects, unsafe URL construction, and trusting forwarded headers without a defined proxy policy.
- Use secure, HTTP-only, same-site cookies as appropriate for sensitive sessions.
- Return generic messages to clients and retain actionable diagnostics only in protected server logs.

# Testing strategy

Use the test tools already present in the repository. Do not introduce a new test framework for a single change.

Testing runs on Vitest, invoked by `npm test`. It is the single runner for both server-side logic and component behaviour, so the project carries one assertion API and one configuration. Component tests run against jsdom with `@testing-library/react`.

Tests that exercise persistence MUST run against a real PostgreSQL instance, not a mocked database: invariants are enforced by database constraints and row locks, which a mock cannot verify.

For each behavior change, cover the lowest useful level:

- Pure domain rules: unit tests
- Drizzle queries, constraints, and transactions: PostgreSQL integration tests
- Server Actions and Route Handlers: boundary, authorization, and failure tests
- React Aria UI: semantic interaction tests using realistic user events
- Critical cross-page flows: browser-level tests

Tests should assert user-visible behavior, domain outcomes, database state, and accessibility semantics. Avoid snapshots as the only proof of interactive behavior.

Include failure cases, empty states, pending states, unauthorized access, invalid input, duplicate/concurrent writes, and relevant database constraint failures.

# Change gates

Every change MUST satisfy the following gates before it is committed. They are cited by number; do not renumber them.

1. A test exists that was written before the implementation and was observed failing (VII).
2. The implementation is the minimal code that makes that test pass, followed by refactoring with the test green (VII).
3. Every input boundary the change touches validates and sanitizes on the server (II).
4. No new third-party dependency was added without recorded team approval (IV).
5. `npm run style-check:ci` passes with no findings.
6. The diff contains no comments, no commented-out code, and no dead code (V, VI).
7. Every changed line traces to the stated requirement; adjacent code is left untouched.
8. `npm test` passes with no failing or skipped tests.

`npm run verify` runs gates 5 and 8 together with the type check and the build, and is what CI runs; it is the practical way to clear both.

Code review MUST verify each gate explicitly. A reviewer who cannot determine from the diff that a test was written first MUST request that evidence before approving. Changes that violate a principle MUST be corrected or accompanied by an approved amendment; they MUST NOT be merged on the strength of an informal exception.

# Commands and validation

`npm run verify` is the gate: `style-check:ci`, then `type-check`, then `test`, then `build`. CI runs exactly this and nothing else, so green locally means green in CI.

| Task | Command |
| --- | --- |
| Dev server | `npm run dev` |
| Full gate — run before claiming done | `npm run verify` |
| Auto-fix formatting and lint | `npm run fix` |
| Style check only | `npm run style-check:local` |
| Types only | `npm run type-check` |
| All tests once | `npm test` |
| Watch mode | `npm run test:watch` |
| One test file | `npx vitest run src/path/to/thing.test.ts` |
| One test by name | `npx vitest run -t "rejects an unauthenticated caller"` |
| Generate a migration after editing `src/db/schema.ts` | `npm run db:generate` |
| Apply migrations | `npm run db:migrate` |
| Browse the database | `npm run db:studio` |

`npm run build` does not run Biome; only `verify` does. Do not report a check as passing unless you ran it and saw it pass.